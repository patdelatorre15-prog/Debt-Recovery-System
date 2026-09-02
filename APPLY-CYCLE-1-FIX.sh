#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f package.json || ! -f worker/wrangler.toml ]]; then
  echo "Run this script from the repository root."
  exit 1
fi

echo "Running local validation..."
npm run check

echo
echo "Validation passed. Deploy in this order:"
echo "1. Back up the production D1 database."
echo "2. Apply worker/migrations/0003_cycle1_fixes.sql to the existing D1 database."
echo "3. Deploy the Worker from worker/."
echo "4. Deploy the Pages/static files from this repository root."
echo "5. Run manual Cycle 1 regression tests before launch approval."
echo
echo "This script deliberately does not deploy or modify production data automatically."
