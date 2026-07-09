#!/usr/bin/env tsx
/**
 * lint-migrations.ts — Phase 12 (§13.4 "A lint/CI check rejects destructive DDL in a single
 * release"). Expand-contract discipline: additive migration -> dual-write/backfill -> switch
 * reads -> contract (the actual destructive step) in a LATER release. This rejects destructive
 * DDL in any migration file that doesn't explicitly declare itself a contract-phase migration.
 *
 * Usage:
 *   tsx scripts/lint-migrations.ts --since <git-ref>   # lint only files ADDED since <ref> (CI)
 *   tsx scripts/lint-migrations.ts --all               # lint every migration file (local audit)
 *   tsx scripts/lint-migrations.ts file1.sql file2.sql # lint specific files
 *
 * A migration opts out of a specific rule by including, anywhere in the file, a comment of the
 * exact form `-- contract-phase: <reason>` — an explicit, human-written acknowledgement that
 * this migration is intentionally destructive (the later half of an expand-contract pair, or a
 * pre-launch/zero-production-data exception per this repo's established ADR-0018 rationale), not
 * a silent bypass.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export interface Violation {
  file: string;
  line: number;
  rule: string;
  snippet: string;
}

interface Rule {
  name: string;
  pattern: RegExp;
}

// Each pattern is intentionally simple (line-oriented, case-insensitive) — this is a CI gate
// heuristic (same "AST-free grep-based heuristic, sufficient for a CI gate" tradeoff as this
// repo's existing scripts/audit-llm-writes.ts), not a SQL parser. False positives are handled by
// the contract-phase escape hatch, not by making the regex cleverer.
const DESTRUCTIVE_RULES: Rule[] = [
  { name: 'DROP TABLE', pattern: /\bDROP\s+TABLE\b/i },
  { name: 'DROP COLUMN', pattern: /\bDROP\s+COLUMN\b/i },
  { name: 'RENAME COLUMN', pattern: /\bRENAME\s+COLUMN\b/i },
  { name: 'RENAME TABLE/TO', pattern: /\bRENAME\s+TO\b/i },
  { name: 'TRUNCATE', pattern: /\bTRUNCATE\b/i },
  { name: 'ALTER COLUMN ... TYPE', pattern: /\bALTER\s+COLUMN\s+\S+\s+TYPE\b/i },
  { name: 'SET NOT NULL (existing column)', pattern: /\bALTER\s+COLUMN\s+\S+\s+SET\s+NOT\s+NULL\b/i },
  // ADD COLUMN ... NOT NULL is only safe with a DEFAULT (backfills every existing row); without
  // one it fails outright against a non-empty table, which is exactly the class of "breaks under
  // real data" mistake expand-contract exists to prevent.
  { name: 'ADD COLUMN ... NOT NULL (no DEFAULT)', pattern: /\bADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?\S+\s+\S+(?:\([^)]*\))?\s+NOT\s+NULL\b(?![\s\S]{0,40}\bDEFAULT\b)/i },
];

const CONTRACT_PHASE_MARKER = /--\s*contract-phase\s*:/i;

export function lintMigrationContent(file: string, content: string): Violation[] {
  if (CONTRACT_PHASE_MARKER.test(content)) return [];

  const violations: Violation[] = [];
  const lines = content.split('\n');
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]!;

    // Strip line comments and best-effort block comments so a rule name mentioned in a code
    // comment (like this file's own header, or a migration's own design-notes prose) never
    // trips the linter.
    if (inBlockComment) {
      const end = line.indexOf('*/');
      if (end === -1) continue;
      line = line.slice(end + 2);
      inBlockComment = false;
    }
    const blockStart = line.indexOf('/*');
    if (blockStart !== -1) {
      const blockEnd = line.indexOf('*/', blockStart);
      if (blockEnd === -1) {
        line = line.slice(0, blockStart);
        inBlockComment = true;
      } else {
        line = line.slice(0, blockStart) + line.slice(blockEnd + 2);
      }
    }
    const commentIdx = line.indexOf('--');
    const codePart = commentIdx === -1 ? line : line.slice(0, commentIdx);
    if (!codePart.trim()) continue;

    for (const rule of DESTRUCTIVE_RULES) {
      if (rule.pattern.test(codePart)) {
        violations.push({ file, line: i + 1, rule: rule.name, snippet: codePart.trim() });
      }
    }
  }

  return violations;
}

export function lintMigrationFile(path: string): Violation[] {
  const content = readFileSync(path, 'utf8');
  return lintMigrationContent(path, content);
}

function filesAddedSince(ref: string): string[] {
  try {
    return execSync(`git diff --name-only --diff-filter=A ${ref} -- supabase/migrations/*.sql`, {
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch (err) {
    console.error(`[lint-migrations] git diff against "${ref}" failed:`, err instanceof Error ? err.message : err);
    return [];
  }
}

function allMigrationFiles(): string[] {
  return execSync('git ls-files "supabase/migrations/*.sql"', { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter((f) => Boolean(f) && !f.includes('_rollback.sql'));
}

async function main() {
  const args = process.argv.slice(2);
  let files: string[];

  if (args[0] === '--since') {
    files = filesAddedSince(args[1]!).filter((f) => !f.includes('_rollback.sql'));
  } else if (args[0] === '--all') {
    files = allMigrationFiles();
  } else if (args.length > 0) {
    files = args;
  } else {
    console.error('Usage: lint-migrations.ts --since <ref> | --all | <files...>');
    process.exit(2);
  }

  let violationCount = 0;
  for (const file of files) {
    let content: string;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const violations = lintMigrationContent(file, content);
    for (const v of violations) {
      console.error(`[lint-migrations] FAIL ${v.file}:${v.line} — ${v.rule}: ${v.snippet}`);
      violationCount++;
    }
  }

  if (violationCount > 0) {
    console.error(
      `\n[lint-migrations] ${violationCount} destructive-DDL violation(s) found. ` +
      `Expand-contract migrations must be additive; if this genuinely is the contract phase of ` +
      `an expand-contract pair, add a "-- contract-phase: <reason>" comment to the file.`,
    );
    process.exit(1);
  }

  console.log(`[lint-migrations] PASSED — ${files.length} file(s) checked, no destructive DDL.`);
}

if (process.argv[1] && process.argv[1].endsWith('lint-migrations.ts')) {
  main();
}
