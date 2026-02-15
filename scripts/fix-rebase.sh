#!/usr/bin/env bash

# fix-rebase.sh
# Automated script to handle Git rebase issues following the protocol
# described in the rebase resolution documentation.
#
# Usage: bash scripts/fix-rebase.sh [--abort]
# Options:
#   --abort    Prefer aborting the rebase instead of completing it

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PREFER_ABORT=false
if [[ "${1:-}" == "--abort" ]]; then
  PREFER_ABORT=true
  echo -e "${YELLOW}Mode: Will prefer aborting rebase if encountered${NC}"
fi

echo "======================================"
echo "Git Rebase Resolution Script"
echo "======================================"
echo ""

# Step 1: Confirm rebase state
echo -e "${BLUE}Step 1: Checking rebase state...${NC}"
GIT_STATUS=$(git status)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "Current branch: $CURRENT_BRANCH"
echo ""

if echo "$GIT_STATUS" | grep -q "You are currently rebasing"; then
  echo -e "${YELLOW}⚠️  Rebase detected! Repository is in rebase state.${NC}"
  IN_REBASE=true
else
  echo -e "${GREEN}✓ No rebase in progress${NC}"
  IN_REBASE=false
fi
echo ""

# If not in rebase, just verify and exit
if [ "$IN_REBASE" = false ]; then
  echo -e "${BLUE}Step 2-3: Skipping (no rebase to resolve)${NC}"
  echo ""
  
  echo -e "${BLUE}Step 4: Verifying branch state...${NC}"
  git status
  echo ""
  echo "Recent commits:"
  git log --oneline -10
  echo ""
  
  echo -e "${BLUE}Step 5: Checking sync with origin...${NC}"
  git fetch origin "$CURRENT_BRANCH" 2>/dev/null || true
  
  if git rev-parse "origin/$CURRENT_BRANCH" >/dev/null 2>&1; then
    COMMITS_AHEAD=$(git rev-list --count "origin/$CURRENT_BRANCH..HEAD")
    echo "Commits ahead of origin/$CURRENT_BRANCH: $COMMITS_AHEAD"
    
    if [ "$COMMITS_AHEAD" -eq 0 ]; then
      echo -e "${GREEN}✓ Local and remote are synchronized${NC}"
    else
      echo -e "${YELLOW}Local is $COMMITS_AHEAD commit(s) ahead of remote${NC}"
      echo ""
      read -p "Push to origin/$CURRENT_BRANCH? (y/N) " -n 1 -r
      echo ""
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Attempting normal push..."
        if git push origin "$CURRENT_BRANCH"; then
          echo -e "${GREEN}✓ Push successful${NC}"
        else
          echo -e "${YELLOW}Normal push failed. Try force-with-lease? (y/N)${NC}"
          read -p "" -n 1 -r
          echo ""
          if [[ $REPLY =~ ^[Yy]$ ]]; then
            git push --force-with-lease origin "$CURRENT_BRANCH"
            echo -e "${GREEN}✓ Force push successful${NC}"
          fi
        fi
      fi
    fi
  else
    echo -e "${YELLOW}No remote tracking branch found${NC}"
  fi
  
  echo ""
  echo -e "${GREEN}======================================"
  echo "✓ Repository is in clean state"
  echo "======================================${NC}"
  exit 0
fi

# Handle active rebase
echo -e "${BLUE}Step 2: Checking for conflicts...${NC}"
CONFLICTS=$(git diff --name-only --diff-filter=U || true)

if [ -n "$CONFLICTS" ]; then
  echo -e "${RED}Conflicts detected in the following files:${NC}"
  echo "$CONFLICTS"
  echo ""
  
  if [ "$PREFER_ABORT" = true ]; then
    echo -e "${YELLOW}Aborting rebase as requested...${NC}"
    git rebase --abort
    echo -e "${GREEN}✓ Rebase aborted${NC}"
    git status
    exit 0
  fi
  
  echo -e "${YELLOW}Please resolve conflicts manually:${NC}"
  echo "1. Edit each conflicted file"
  echo "2. Remove conflict markers (<<<<<<<, =======, >>>>>>>)"
  echo "3. Stage resolved files: git add <file>"
  echo "4. Run this script again to continue"
  echo ""
  exit 1
else
  echo -e "${GREEN}✓ No conflicts detected${NC}"
fi

# Attempt to continue rebase
echo ""
echo -e "${BLUE}Step 3: Attempting to continue rebase...${NC}"

if [ "$PREFER_ABORT" = true ]; then
  echo -e "${YELLOW}Aborting rebase as requested...${NC}"
  git rebase --abort
  echo -e "${GREEN}✓ Rebase aborted${NC}"
  git status
  exit 0
fi

# Try to continue
if git rebase --continue 2>&1 | tee /tmp/rebase-output.txt; then
  echo -e "${GREEN}✓ Rebase continued successfully${NC}"
elif grep -q "No changes.*did you forget to use 'git add'" /tmp/rebase-output.txt; then
  echo -e "${YELLOW}Empty commit detected, skipping...${NC}"
  git rebase --skip
  echo -e "${GREEN}✓ Rebase skipped empty commit${NC}"
else
  echo -e "${RED}Rebase continue failed. Check output above.${NC}"
  echo ""
  echo "Options:"
  echo "  - Resolve any remaining conflicts and re-run this script"
  echo "  - Run with --abort flag to abort the rebase"
  exit 1
fi

# Check if rebase completed
if git status | grep -q "You are currently rebasing"; then
  echo -e "${YELLOW}Rebase still in progress. Re-run this script to continue.${NC}"
  exit 0
fi

# Step 4: Verify final state
echo ""
echo -e "${BLUE}Step 4: Verifying final state...${NC}"
git status
echo ""
echo "Recent commits:"
git log --oneline -10
echo ""

# Step 5: Offer to push
echo -e "${BLUE}Step 5: Ready to push...${NC}"
read -p "Push to origin/$CURRENT_BRANCH? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  if git push origin "$CURRENT_BRANCH" 2>&1; then
    echo -e "${GREEN}✓ Push successful${NC}"
  else
    echo -e "${YELLOW}Normal push rejected. Using --force-with-lease...${NC}"
    git push --force-with-lease origin "$CURRENT_BRANCH"
    echo -e "${GREEN}✓ Force push successful${NC}"
  fi
  
  # Step 6: Final verification
  echo ""
  echo -e "${BLUE}Step 6: Final verification...${NC}"
  git status
  
  COMMITS_AHEAD=$(git rev-list --count "origin/$CURRENT_BRANCH..HEAD" || echo "N/A")
  echo "Commits ahead of origin: $COMMITS_AHEAD"
  
  if [ "$COMMITS_AHEAD" = "0" ]; then
    echo -e "${GREEN}✓ Remote is fully synchronized${NC}"
  fi
fi

echo ""
echo -e "${GREEN}======================================"
echo "✓ Rebase resolution complete"
echo "======================================${NC}"
