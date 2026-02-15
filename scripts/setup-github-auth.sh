#!/usr/bin/env bash
# GOAL: Make git fetch/push work to GitHub from Replit Shell using a new PAT.
# ASSUMPTION: The new token is stored in Replit Secrets as GITHUB_TOKEN.

set -euo pipefail

echo "=== GitHub Authentication Setup for Replit ==="
echo

# 0) Sanity: confirm token exists in env
echo "Step 0: Checking for GITHUB_TOKEN in environment..."
if python -c "import os; print('GITHUB_TOKEN' in os.environ)" | grep -q "True"; then
  echo "✓ GITHUB_TOKEN found in environment"
  # Show first 4 chars for verification (never show full token)
  echo "  Token preview: $(python -c "import os; t=os.getenv('GITHUB_TOKEN',''); print(t[:4] + '...' if len(t) > 4 else 'ERROR: Token too short')")"
else
  echo "✗ ERROR: GITHUB_TOKEN not found in environment"
  echo "  Please add GITHUB_TOKEN to Replit Secrets (lock icon in sidebar)"
  exit 1
fi
echo

# 1) Remove any token-embedded origin URL (never keep secrets in remotes)
echo "Step 1: Cleaning remote URL (removing any embedded tokens)..."
CURRENT_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [[ "$CURRENT_URL" == *"@github.com"* ]]; then
  echo "  Removing embedded credentials from remote URL"
fi
git remote set-url origin https://github.com/Swixixle/Asset-Analyzer.git
echo "✓ Remote URL set to: https://github.com/Swixixle/Asset-Analyzer.git"
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
  python -c "import os; t=os.getenv('GITHUB_TOKEN',''); print('  ' + t[:4] + '...' if len(t) > 4 else '  ERROR: Token not found or too short')"
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
