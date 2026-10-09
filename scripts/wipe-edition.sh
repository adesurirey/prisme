#!/usr/bin/env bash
# Wipe the edition archive and rebuild from scratch.
#
# Deletes data/stories/ and data/edition.json (keeping classifications.json —
# Article ids are content-based, so the cache stays valid), then runs the
# edition pipeline. Git history is the only rollback path, so the script
# refuses to run on a dirty or unpushed tree.
#
# Usage: scripts/wipe-edition.sh [--yes] [--force]
#   --yes    skip the confirmation prompt
#   --force  bypass the git cleanliness/push checks

set -euo pipefail

YES=0
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --yes) YES=1 ;;
    --force) FORCE=1 ;;
    *) echo "Unknown argument: $arg"; echo "Usage: $0 [--yes] [--force]"; exit 2 ;;
  esac
done

# 1. Guard: repo root + data/ present.
if [ ! -f package.json ] || [ ! -d pipeline ]; then
  echo "error: run from the repo root"; exit 1
fi
if [ ! -d data ] || [ ! -f data/edition.json ]; then
  echo "error: data/edition.json not found — nothing to wipe"; exit 1
fi

# 2. Safety check: git history is the rollback path, it must be intact.
if [ "$FORCE" -ne 1 ]; then
  if [ -n "$(git status --porcelain)" ]; then
    echo "error: working tree is dirty; commit or stash first (rollback depends on git history). Use --force to override."
    exit 1
  fi
  if ! git diff --quiet @{u}..HEAD 2>/dev/null; then
    echo "error: current branch has unpushed commits; push first (rollback depends on git history). Use --force to override."
    exit 1
  fi
fi

# 3. Confirm.
story_count=$(find data/stories -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
if [ "$YES" -ne 1 ]; then
  echo "This will permanently delete:"
  echo "  - data/stories/ ($story_count Story files)"
  echo "  - data/edition.json"
  echo "Kept: data/classifications.json (classification cache stays valid)."
  echo "Rollback is only possible via git history (git checkout HEAD~1 -- data)."
  printf 'Continue? [y/N] '
  read -r reply
  case "$reply" in
    y|Y|yes|YES) ;;
    *) echo "aborted"; exit 1 ;;
  esac
fi

# 4. Wipe.
rm -rf data/stories data/edition.json
echo "wiped: data/stories/, data/edition.json"

# 5. Run the edition. The pipeline needs keys in the shell env; .env is not
# loaded by tsx, so export it here (does not print the values).
set -a
# shellcheck disable=SC1091
source .env
set +a
pnpm edition

echo
echo "Edition rebuilt from scratch. Commit the result yourself, e.g.:"
echo "  git add data && git commit -m 'data: from-scratch edition (\$(date -u +%%Y-%%m-%%dT%%H:%%M:%%SZ))'"