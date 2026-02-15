#!/usr/bin/env bash
# GOAL: Make git fetch/push work to GitHub from Replit Shell using a new PAT.
# ASSUMPTION: The new token is stored in Replit Secrets as GITHUB_TOKEN.

set -euo pipefail

echo "=== GitHub Authentication Setup for Replit ==="
echo

# 0) Sanity: confirm token exists in env
echo "Step 0: Checking for GITHUB_TOKEN in environment..."
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  echo "✓ GITHUB_TOKEN found in environment"
  # Show first 4 chars for verification (never show full token)
  echo "  Token preview: ${GITHUB_TOKEN:0:4}..."
else
  echo "✗ ERROR: GITHUB_TOKEN not found in environment"
  echo "  Please add GITHUB_TOKEN to Replit Secrets (lock icon in sidebar)"
  exit 1
fi
echo

# 1) Remove any token-embedded origin URL (never keep secrets in remotes)
echo "Step 1: Cleaning remote URL (removing any embedded tokens)..."
CURRENT_URL=$(git remote get-url origin 2>/dev/null || echo "")

if [[ -z "$CURRENT_URL" ]]; then
  echo "  Warning: No origin remote found, using default repository"
  CLEAN_URL="https://github.com/Swixixle/Asset-Analyzer.git"
  git remote add origin "$CLEAN_URL"
elif [[ "$CURRENT_URL" == *"@github.com"* ]]; then
  echo "  Removing embedded credentials from remote URL"
  # Extract repo path from URL like https://token@github.com/user/repo.git
  CLEAN_URL=$(echo "$CURRENT_URL" | sed -E 's|https://[^@]+@github.com|https://github.com|')
  git remote set-url origin "$CLEAN_URL"
elif [[ "$CURRENT_URL" == https://github.com/* ]]; then
  # URL is already clean
  CLEAN_URL="$CURRENT_URL"
  echo "  URL is already clean (no embedded credentials)"
else
  # Non-GitHub URL or unexpected format
  echo "  Warning: URL is not a GitHub HTTPS URL: $CURRENT_URL"
  echo "  Keeping current URL unchanged"
  CLEAN_URL="$CURRENT_URL"
fi

echo "✓ Remote URL: $CLEAN_URL"
git remote -v
echo

# 2) Configure git to use a stored credential file
echo "Step 2: Configuring git credential helper..."
git config --global credential.helper store
echo "✓ Git configured to use credential.helper=store"
echo

# 3) Write credentials in the correct format:
# username = x-access-token
# password = $GITHUB_TOKEN
echo "Step 3: Writing credentials to ~/.git-credentials..."
printf "https://x-access-token:%s@github.com\n" "$GITHUB_TOKEN" > ~/.git-credentials
chmod 600 ~/.git-credentials
echo "✓ Credentials written and secured (chmod 600)"
echo

# 4) Clear any stale locks (common on Replit)
echo "Step 4: Clearing any stale git locks..."
rm -f .git/index.lock .git/REBASE_HEAD.lock 2>/dev/null || true
echo "✓ Git locks cleared"
echo

# 5) Test auth
echo "Step 5: Testing authentication with git fetch..."
if git fetch origin; then
  echo "✓ Authentication test PASSED - git fetch succeeded"
else
  echo "✗ Authentication test FAILED - git fetch failed"
  echo
  echo "Debug information:"
  echo "  Remote URLs:"
  git remote -v
  echo
  echo "  Credential file:"
  ls -la ~/.git-credentials 2>/dev/null || echo "    (file not found)"
  echo
  echo "  Credential helper:"
  git config --global --get credential.helper || echo "    (not configured)"
  echo
  echo "  Token preview:"
  echo "  ${GITHUB_TOKEN:0:4}..."
  exit 1
fi
echo

# 6) Show final status
echo "Step 6: Checking repository status..."
git status
echo

echo "=== Setup Complete ==="
echo "Git authentication is now configured for GitHub operations."
echo "You can now use git fetch, git push, and other operations."
echo
echo "If you need to update the token:"
echo "  1. Update GITHUB_TOKEN in Replit Secrets"
echo "  2. Run this script again: bash scripts/setup-github-auth.sh"
