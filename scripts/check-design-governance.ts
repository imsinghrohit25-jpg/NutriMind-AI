#!/usr/bin/env tsx
/**
 * check-design-governance.ts — Premium redesign (ADR-0034) governance gate, run at every phase's
 * G-gate (G0..G6). Same "line-oriented regex heuristic, sufficient for a CI gate" tradeoff as
 * scripts/lint-migrations.ts — not a Dart AST parser.
 *
 * Rules (all scoped to apps/mobile/lib/**\/*.dart, excluding the design system itself and
 * generated *.g.dart files):
 *   1. No raw hex color literal (`Color(0xFF...)` / `Colors.<name>` handled separately as INFO —
 *      Colors.<name> is sometimes legitimate for one-off transparency masks, so only Color(0x...)
 *      is a hard FAIL).
 *   2. No raw `TextStyle(fontSize: ...)` — must come from AppType/Theme.of(context).textTheme.
 *   3. No raw `Duration(milliseconds: ...)` / `Duration(seconds: ...)` used as an animation
 *      duration — must come from AppMotion. Non-animation durations (network timeouts, scanner
 *      cooldowns/throttles, redirect timers) are legitimately outside this rule's scope but a
 *      regex can't tell intent apart, so such a line must carry an explicit
 *      `// design-governance:ignore <reason>` directive to be exempted — an auditable opt-out,
 *      not a silent heuristic. Animation durations are never ignored; they move to AppMotion.
 *
 * Inline opt-out: any line ending in `// design-governance:ignore[: <reason>]` is skipped for all
 * rules. Reserve it for genuine non-design values (functional timeouts). A reason is encouraged.
 *
 * Usage: tsx scripts/check-design-governance.ts
 * Exit code 0 = clean, 1 = violations found.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

interface Violation {
  file: string;
  line: number;
  rule: string;
  snippet: string;
}

const EXCLUDED_PATH_FRAGMENTS = [
  '/core/design_system/', // the tokens themselves legitimately define these values
  '.g.dart',              // generated code (riverpod/drift codegen) — not hand-authored
];

const RULES: { name: string; pattern: RegExp }[] = [
  { name: 'raw hex color (Color(0x...))', pattern: /Color\(\s*0x[0-9A-Fa-f]{6,8}\s*\)/ },
  { name: 'raw TextStyle(fontSize: ...)', pattern: /TextStyle\([^)]*fontSize\s*:/ },
  { name: 'raw Duration(...) literal', pattern: /\bDuration\(\s*(milliseconds|seconds)\s*:/ },
];

// An auditable per-line opt-out for genuine non-design values (functional timeouts, cooldowns).
const IGNORE_DIRECTIVE = /\/\/\s*design-governance:ignore\b/;

function listDartFiles(): string[] {
  const out = execSync('git ls-files "apps/mobile/lib/**/*.dart"', { encoding: 'utf8' });
  return out
    .split('\n')
    .map((f) => f.trim())
    .filter((f) => f.length > 0)
    .filter((f) => !EXCLUDED_PATH_FRAGMENTS.some((frag) => f.includes(frag)));
}

function checkFile(file: string): Violation[] {
  const violations: Violation[] = [];
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, idx) => {
    if (IGNORE_DIRECTIVE.test(line)) return; // explicit, auditable opt-out for functional values
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        violations.push({ file, line: idx + 1, rule: rule.name, snippet: line.trim() });
      }
    }
  });
  return violations;
}

function main(): void {
  const files = listDartFiles();
  const violations = files.flatMap(checkFile);

  if (violations.length === 0) {
    console.log(`[check-design-governance] PASSED — ${files.length} file(s) checked, no violations.`);
    return;
  }

  for (const v of violations) {
    console.error(`[check-design-governance] FAIL ${v.file}:${v.line} — ${v.rule}: ${v.snippet}`);
  }
  console.error(`\n[check-design-governance] ${violations.length} violation(s) found across ${files.length} file(s) checked.`);
  process.exitCode = 1;
}

main();
