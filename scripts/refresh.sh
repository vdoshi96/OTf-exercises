#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TIKTOK_USER="coachingotf"
TIKTOK_URL="https://www.tiktok.com/@${TIKTOK_USER}"
IG_PROFILES="${IG_PROFILES:-coachingotf}"

cd "$PROJECT_DIR"

echo "=== OTF Exercise Directory — Data Refresh ==="
echo ""

# Step 1: Scrape TikTok metadata with yt-dlp
echo "[1/6] Downloading TikTok metadata..."
mkdir -p metadata
yt-dlp --skip-download --write-info-json \
  --output "metadata/%(id)s" \
  "$TIKTOK_URL" 2>&1 || {
    echo "WARNING: yt-dlp TikTok scrape failed or was incomplete."
    echo "You may need to update yt-dlp (brew upgrade yt-dlp) or collect URLs manually."
}

FILE_COUNT=$(find metadata -name "*.info.json" -not -name "*playlist*" | wc -l | tr -d ' ')
echo "Found $FILE_COUNT TikTok metadata files"
echo ""

# Step 2: Scrape Instagram metadata with instaloader
echo "[2/6] Downloading Instagram metadata..."
if command -v python3 &>/dev/null && python3 -c "import instaloader" 2>/dev/null; then
  python3 "$SCRIPT_DIR/scrape_instagram.py" --user "${IG_USERNAME:-}" --profiles "$IG_PROFILES" || {
    echo "WARNING: Instagram scrape failed. Run manually with:"
    echo "  python3 scripts/scrape_instagram.py --user YOUR_IG_USERNAME --profiles $IG_PROFILES"
  }
else
  echo "SKIPPED: instaloader not installed. Run: pip3 install instaloader --break-system-packages"
fi
echo ""

# Step 3: Parse TikTok metadata into raw_videos.json
echo "[3/6] Parsing TikTok metadata..."
python3 "$SCRIPT_DIR/parse_metadata.py"
echo ""

# Step 4: Enrich all data (TikTok + Instagram if available)
echo "[4/6] Enriching with local pattern matching..."
python3 "$SCRIPT_DIR/enrich_local.py"
echo ""

# Step 5: Merge and filter into fresh flat exercise data
echo "[5/6] Merging and filtering into src/data/exercises_flat.json..."
python3 "$SCRIPT_DIR/merge_and_filter.py"
echo ""

# Step 6: Group exercises by name
echo "[6/6] Grouping src/data/exercises_flat.json into src/data/exercises.json..."
python3 "$SCRIPT_DIR/group_exercises.py"
echo ""

echo "=== Done ==="
echo "If exercises.json was updated, rebuild and redeploy:"
echo "  npm run build"
echo "  git add . && git commit -m 'Update exercise data' && git push"
