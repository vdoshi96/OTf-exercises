#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TIKTOK_USER="coachingotf"
TIKTOK_URL="https://www.tiktok.com/@${TIKTOK_USER}"

cd "$PROJECT_DIR"

echo "=== OTF Exercise Directory — Data Refresh ==="
echo "Scraping metadata from $TIKTOK_URL"
echo ""

# Step 1: Scrape metadata with yt-dlp
echo "[1/4] Downloading video metadata..."
mkdir -p metadata
yt-dlp --skip-download --write-info-json \
  --output "metadata/%(id)s" \
  "$TIKTOK_URL" 2>&1 || {
    echo "WARNING: yt-dlp scrape failed or was incomplete."
    echo "You may need to update yt-dlp (brew upgrade yt-dlp) or collect URLs manually."
    echo "Put URLs in urls.txt (one per line) and run:"
    echo "  yt-dlp --skip-download --write-info-json -a urls.txt --output 'metadata/%(id)s'"
}

FILE_COUNT=$(find metadata -name "*.info.json" -not -name "*playlist*" | wc -l | tr -d ' ')
echo "Found $FILE_COUNT metadata files"
echo ""

# Step 2: Parse metadata into raw_videos.json
echo "[2/4] Parsing metadata..."
python3 "$SCRIPT_DIR/parse_metadata.py"
echo ""

# Step 3: Enrich with LLM (requires ANTHROPIC_API_KEY)
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  echo "[3/4] Enriching with Claude API..."
  python3 "$SCRIPT_DIR/enrich_metadata.py"
else
  echo "[3/4] SKIPPED: Set ANTHROPIC_API_KEY to enable LLM enrichment"
  echo "  export ANTHROPIC_API_KEY=sk-ant-..."
  echo "  pip3 install anthropic"
fi
echo ""

# Step 4: Merge and filter into exercises.json
if [ -f "$PROJECT_DIR/enriched_videos.json" ]; then
  echo "[4/4] Merging and filtering..."
  python3 "$SCRIPT_DIR/merge_and_filter.py"
else
  echo "[4/4] SKIPPED: No enriched_videos.json found (run step 3 first)"
fi

echo ""
echo "=== Done ==="
echo "If exercises.json was updated, rebuild and redeploy:"
echo "  npm run build"
echo "  git add . && git commit -m 'Update exercise data' && git push"
