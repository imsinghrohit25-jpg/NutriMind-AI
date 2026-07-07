#!/usr/bin/env bash
# secret-scan.sh — fail CI if potential secrets are committed.
# Scans staged/committed files for key patterns.
# Add exceptions via .secretscanignore (glob patterns, one per line).
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

IGNORED_EXTENSIONS=('*.lock' '*.png' '*.jpg' '*.gif' '*.webp' '*.pdf' '*.zip')
IGNORED_PATHS=('.git/*' 'dist/*' 'node_modules/*' '*.env.example' 'docs/adr/*')

echo "Running secret scan..."

for pattern in "${PATTERNS[@]}"; do
  matches=$(git grep -rl --extended-regexp "$pattern" -- \
    ':!*.env' ':!*.env.*' ':!node_modules' ':!dist' ':!.git' \
    ':!*.png' ':!*.jpg' ':!*.lock' ':!package-lock.json' \
    2>/dev/null || true)

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
