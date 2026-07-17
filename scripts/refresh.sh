#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
APPLY=false

for argument in "$@"; do
  if [[ "$argument" == "--apply" ]]; then
    APPLY=true
    break
  fi
done

cd "$PROJECT_DIR"

echo "=== OTF Exercise Directory — Safe Incremental Refresh ==="
python3 "$SCRIPT_DIR/refresh_incremental.py" "$@"

if [[ "$APPLY" == true ]]; then
  echo ""
  echo "Self-hosting and validating thumbnails..."
  node "$SCRIPT_DIR/ensure-thumbnails.mjs"

  echo ""
  echo "Checking catalog integrity..."
  node "$SCRIPT_DIR/check_catalog_integrity.mjs" --latest-thumbnail-report
else
  echo ""
  echo "No tracked files were changed. Re-run with --apply after reviewing the dry run."
fi
