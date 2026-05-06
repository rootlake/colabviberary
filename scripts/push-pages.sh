#!/usr/bin/env bash
# Publish the Vibe-rary to GitHub (triggers GitHub Pages from main).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DEFAULT_MSG="Update Vibe-rary $(date -u +'%Y-%m-%d %H:%M UTC')"
MSG="${1:-$DEFAULT_MSG}"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Error: not inside a git repo (expected $ROOT)." >&2
  exit 1
fi

REMOTE="${PAGES_REMOTE:-origin}"
BRANCH="${PAGES_BRANCH:-main}"

git add -A
if git diff --staged --quiet; then
  echo "Nothing to commit — working tree matches last commit."
else
  git commit -m "$MSG"
fi

git push "$REMOTE" "$BRANCH"
echo "Pushed $BRANCH to $REMOTE. GitHub Pages:"
echo "  https://rootlake.github.io/colabviberary/"
echo "(Allow a minute after the push for the site to refresh.)"
