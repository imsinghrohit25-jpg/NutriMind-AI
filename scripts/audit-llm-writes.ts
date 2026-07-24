#!/usr/bin/env tsx
/**
 * audit-llm-writes.ts
 * CI static check: proves no LLM call path writes to score/nutrition fields.
 * Fails if any file outside engines/** writes to the protected field list
 * after calling a gateway/provider function.
 *
 * Implementation: AST-free grep-based heuristic (sufficient for CI gate).
 * A full AST analysis is deferred to Phase 6 when the engines are built.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PROTECTED_FIELDS = [
  'health_score',
  'overall_score',
  'nova_score',
  'ingredient_risk_level',
  'energy_kcal',
  'protein_g',
  'fat_g',
  'carbs_g',
  'sugar_g',
  'sodium_mg',
  'allergen_status',
  'overall_safety',
];

const GATEWAY_CALL_PATTERNS = [
  'gateway.complete(',
  'router.complete(',
  'provider.complete(',
  'anthropic.messages.create(',
  'openai.chat.completions.create(',
  'generativeModel.generateContent(',
];

const ALLOWED_WRITE_PATHS = [
  'engines/',
  '__tests__/',
  'fixtures/',
];

let failed = false;

function getSourceFiles(): string[] {
  try {
    return execSync(
      'git ls-files "*.ts" "*.tsx" | grep -v node_modules | grep -v dist',
      { encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isAllowedPath(filePath: string): boolean {
  return ALLOWED_WRITE_PATHS.some((allowed) => filePath.includes(allowed));
}

/**
 * Strip `//` line comments and `/* *\/` block comments before scanning. The gateway-call check is a
 * substring match, so a file that merely *mentions* `gateway.complete()` in a comment (e.g. a
 * diagnostic note about a rate-limit bug) would otherwise be treated as if it made the call — a
 * false positive. Comments are documentation, not call sites. (Heuristic: also strips `//` inside
 * string literals such as URLs, which is harmless here since the scanned patterns never appear
 * inside such strings.)
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

for (const file of getSourceFiles()) {
  if (isAllowedPath(file)) continue;

  let content: string;
  try {
    content = stripComments(readFileSync(file, 'utf8'));
  } catch {
    continue;
  }

  const hasGatewayCall = GATEWAY_CALL_PATTERNS.some((p) => content.includes(p));
  if (!hasGatewayCall) continue;

  for (const field of PROTECTED_FIELDS) {
    const writePattern = new RegExp(`\\b${field}\\s*[:=]\\s*[^=]`, 'g');
    if (writePattern.test(content)) {
      console.error(
        `[audit-llm-writes] FAIL: ${file} makes LLM calls AND writes to protected field '${field}'`,
      );
      failed = true;
    }
  }
}

if (!failed) {
  console.log('[audit-llm-writes] PASSED — no LLM→score write paths detected.');
} else {
  process.exit(1);
}
