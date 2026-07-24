#!/usr/bin/env bash
# secret-scan.sh — fail CI if potential secrets are committed.
# Scans tracked files for key patterns, at LINE granularity (not just file granularity — see
# SAFE_VALUE_PATTERNS below for why that distinction matters).
#
# Gemini integration addendum (Gate 0 §4): this script already existed with a real Google API key
# pattern (AIza...) but was never wired into CI (confirmed: zero references in
# .github/workflows/ci.yml or any package.json script before this change) — and running it for the
# first time surfaced a real false positive that explains why: this repo's own import scripts
# (apps/api/src/scripts/import-*.ts) and vitest.setup.ts fall back to the well-known, publicly
# documented local Supabase CLI default connection string
# (postgresql://postgres:postgres@127.0.0.1:54322/postgres) when DATABASE_URL isn't set — not a
# real secret, but its password segment ("postgres", 8 chars) satisfied the generic
# `postgresql://user:8+char-password@` pattern. The header previously claimed a
# `.secretscanignore` (glob, file-level) escape hatch that was never actually implemented anywhere
# in this script — dead documentation, not a working feature (same "built but not wired" class of
# bug found repeatedly elsewhere in this codebase). Replaced with a real, working, LINE-level safe-
# value allowlist below: precise (only suppresses the exact known-safe substring, not the whole
# file), so a genuinely different secret landing in one of these same files would still be caught.
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; RESET='\033[0m'
FAIL=0

PATTERNS=(
  'SUPABASE_SERVICE_ROLE_KEY=[^$]'
  'SUPABASE_JWT_SECRET=[^$]'
  'ANTHROPIC_API_KEY=sk-'
  'sk-ant-[A-Za-z0-9_-]{20,}'
  'sk-[A-Za-z0-9]{48}'
  'AIza[0-9A-Za-z_-]{35}'
  'sbp_[a-f0-9]{40}'
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{50,}'
  'postgresql://[^:]+:[^@]{8,}@'
  'BEGIN (RSA |EC )?PRIVATE KEY'
  'PRIVATE_KEY=[^$]'
  'API_SECRET=[^$]'
)

# Known-safe substrings that would otherwise trip a pattern above — a real value, not a secret.
# Any matched LINE containing one of these is excluded; every other line still fails the scan.
# Matched on the credential itself (host-agnostic — this repo's own scripts use both
# 127.0.0.1 and localhost for the same real local Supabase CLI default across different files).
SAFE_VALUE_PATTERNS=(
  'postgres:postgres@(127\.0\.0\.1|localhost)'
)

echo "Running secret scan..."

for pattern in "${PATTERNS[@]}"; do
  matches=$(git grep -n --extended-regexp "$pattern" -- \
    ':!*.env' ':!*.env.*' ':!node_modules' ':!dist' ':!.git' \
    ':!*.png' ':!*.jpg' ':!*.lock' ':!package-lock.json' \
    ':!scripts/secret-scan.sh' \
    2>/dev/null || true)

  for safe in "${SAFE_VALUE_PATTERNS[@]}"; do
    if [[ -n "$matches" ]]; then
      matches=$(echo "$matches" | grep -vE "$safe" || true)
    fi
  done

  if [[ -n "$matches" ]]; then
    echo -e "${RED}FAIL${RESET}: Potential secret pattern '$pattern' found in:"
    echo "$matches" | sed 's/^/  /'
    FAIL=1
  fi
done

if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}Secret scan PASSED — no secrets detected in tracked files.${RESET}"
else
  echo -e "${RED}Secret scan FAILED — review files above before committing.${RESET}"
  exit 1
fi
