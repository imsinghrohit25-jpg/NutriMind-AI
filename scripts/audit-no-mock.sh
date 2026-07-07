#!/usr/bin/env bash
# audit-no-mock.sh — fail CI if TODO/FIXME/mock/placeholder/fake appears
# outside allowed directories (fixtures/, test/, __tests__/).
# Enforces the no-mock policy from BUILD_PLAN.md § 3.
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; RESET='\033[0m'
FAIL=0

FORBIDDEN_PATTERNS=(
  '\bTODO\b'
  '\bFIXME\b'
  '\b[Mm]ock[Dd]ata\b'
  '\bplaceholder\b'
  '\bfakeData\b'
  '\bstub[Rr]esponse\b'
  'HARDCODED'
)

ALLOWED_DIRS=(
  'fixtures'
  '__tests__'
  'test'
  'spec'
  '*.test.ts'
  '*.spec.ts'
  '*.test.tsx'
)

echo "Running no-mock audit..."

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
  matches=$(git grep -rn --extended-regexp --include='*.ts' --include='*.tsx' --include='*.js' \
    "$pattern" -- \
    ':!**/fixtures/**' \
    ':!**/__tests__/**' \
    ':!**/test/**' \
    ':!**/*.test.ts' \
    ':!**/*.spec.ts' \
    ':!**/node_modules/**' \
    ':!**/dist/**' \
    ':!scripts/audit-no-mock.sh' \
    2>/dev/null || true)

  if [[ -n "$matches" ]]; then
    echo -e "${RED}FAIL${RESET}: Found forbidden pattern '$pattern':"
    echo "$matches" | sed 's/^/  /'
    FAIL=1
  fi
done

if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}No-mock audit PASSED — no forbidden patterns found.${RESET}"
else
  echo -e "${RED}No-mock audit FAILED — remove all mock/placeholder code before shipping.${RESET}"
  exit 1
fi
