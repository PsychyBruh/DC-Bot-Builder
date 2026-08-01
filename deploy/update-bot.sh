#!/usr/bin/env bash
# deploy/update-bot.sh — called by botctl update
# Hard-syncs to origin/main, installs deps, restarts the service
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

echo "==> Fetching origin..."
git fetch origin

echo "==> Resetting to origin/main (discards local changes)..."
git reset --hard origin/main

echo "==> Installing dependencies..."
npm ci --omit=dev 2>/dev/null || npm install --omit=dev

echo "==> Restarting service..."
systemctl restart dc-bot-builder 2>/dev/null || systemctl restart dc-bot-builder.service 2>/dev/null || true

echo "==> Done! Current HEAD:"
git log -1 --pretty="%h %ad %s" --date=short
echo ""
echo "Recent changes:"
git log -6 --pretty="%h|%ad|%s" --date=short | while IFS='|' read -r h d subject; do
  short="$subject"
  if [ ${#short} -gt 80 ]; then
    short="${short:0:77}..."
  fi
  echo "  $h ($d) $short"
done
