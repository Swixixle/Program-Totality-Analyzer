#!/usr/bin/env bash
# Repository stability checker for multiple repositories
# Non-destructive - only checks status, does not modify repos

set -euo pipefail

# List of repositories to check (adjust as needed)
REPOS=(Asset-Analyzer HALO-RECEIPTS Lantern ELI)

echo "==================================================="
echo "Repository Stability Check"
echo "==================================================="
echo ""

for r in "${REPOS[@]}"; do
  if [ -d "$r/.git" ]; then
    echo "=== $r ==="
    (
      cd "$r" && \
      git status -sb && \
      git fetch origin 2>/dev/null && \
      echo "ahead: $(git rev-list --count origin/main..HEAD 2>/dev/null || echo n/a)" && \
      echo "behind: $(git rev-list --count HEAD..origin/main 2>/dev/null || echo n/a)"
    )
    echo ""
  else
    echo "SKIP $r (not found or not a git repository)"
    echo ""
  fi
done

echo "==================================================="
echo "Stability Check Complete"
echo "==================================================="
echo ""
echo "If any repo shows 'ahead > 0', run: cd <repo> && git push origin main"
echo "If any repo shows 'behind > 0', run: cd <repo> && git pull --no-rebase origin main"
