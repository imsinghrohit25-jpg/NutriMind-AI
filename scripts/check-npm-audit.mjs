#!/usr/bin/env node
/**
 * check-npm-audit.mjs — CI dependency-audit gate with a documented allowlist.
 *
 * Replaces a bare `npm audit --audit-level=high`, which fails on ANY high/critical advisory in the
 * full transitive tree — including assessed, no-clean-fix vulns in offline tooling. This wrapper
 * still FAILS on every high/critical advisory EXCEPT the explicitly allowlisted ones below, so a
 * genuinely new/other vulnerability continues to break CI.
 *
 * Each allowlist entry MUST document: the advisory, why it's not fixable cleanly, and why it is not
 * exploitable in the running service. Review periodically — remove an entry the moment a
 * non-breaking fix (or a real request-path exposure) appears.
 *
 * Usage: node scripts/check-npm-audit.mjs [--dir apps/api] [--level high]
 */
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const dir = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : 'apps/api';
const level = args.includes('--level') ? args[args.indexOf('--level') + 1] : 'high';
const RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const threshold = RANK[level] ?? 3;

// ── Allowlist: assessed high/critical advisories accepted as CI-passing ─────────────────────────
// Keyed by GHSA/advisory URL. Anything NOT listed here still fails the gate.
const ALLOWLIST = new Map([
  [
    'https://github.com/advisories/GHSA-mh99-v99m-4gvg',
    // brace-expansion DoS/OOM via unbounded expansion. In this tree it is pulled ONLY by
    // `exceljs` → `archiver`/`glob`/`minimatch` (offline .xlsx tooling used by the CoFID data
    // loader) and by dev/test tooling — never on the API request path (the service never runs
    // brace expansion on untrusted user input via these libs). Patched only in brace-expansion
    // 5.0.8, which npm cannot resolve into exceljs's pinned archiver subtree, and npm's only
    // suggested fix is a BREAKING exceljs@3.4.0 downgrade that would break CoFID xlsx parsing.
    // Accepted 2026-07-24; revisit when exceljs ships a fix or a non-breaking override resolves.
    'brace-expansion offline xlsx/build tooling — not on the request path; no non-breaking fix',
  ],
]);

let raw;
try {
  raw = execSync('npm audit --json', { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
} catch (e) {
  // npm audit exits non-zero when vulnerabilities exist; its JSON is still on stdout.
  raw = e.stdout?.toString() || '';
}

let report;
try {
  report = JSON.parse(raw);
} catch {
  console.error('[check-npm-audit] could not parse `npm audit --json` output');
  process.exit(2);
}

const offenders = [];
const allowed = [];
for (const vuln of Object.values(report.vulnerabilities ?? {})) {
  if ((RANK[vuln.severity] ?? 0) < threshold) continue;
  const urls = (vuln.via || [])
    .filter((v) => typeof v === 'object' && v.url)
    .map((v) => v.url);
  // A package flagged only because it "depends on" another vulnerable package has no direct url;
  // it is covered transitively once its root advisory is allowlisted, so don't double-count it.
  if (urls.length === 0) continue;
  for (const url of urls) {
    if (ALLOWLIST.has(url)) allowed.push(`${vuln.name}  ${url}`);
    else offenders.push(`${vuln.severity.toUpperCase()}  ${vuln.name}  ${url}`);
  }
}

if (allowed.length) {
  console.log(`[check-npm-audit] ${allowed.length} advisory reference(s) allowlisted (assessed, no clean fix):`);
  for (const a of [...new Set(allowed)]) console.log('  - ' + a);
}

if (offenders.length) {
  console.error(`\n[check-npm-audit] FAIL — ${offenders.length} non-allowlisted advisory reference(s) at level >= ${level}:`);
  for (const o of [...new Set(offenders)]) console.error('  - ' + o);
  console.error('\nFix them, or (only if assessed and unfixable) add a documented entry to ALLOWLIST.');
  process.exit(1);
}

console.log(`[check-npm-audit] PASSED — no non-allowlisted advisories at level >= ${level} in ${dir}.`);
