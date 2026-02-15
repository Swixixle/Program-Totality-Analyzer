# Rebase Resolution Guide

## Overview

This guide provides tools and procedures for resolving Git rebase issues in the Asset-Analyzer repository. It follows the protocol outlined in the official rebase resolution documentation.

## Quick Start

### Automatic Resolution (Recommended)

Use the automated script for most scenarios:

```bash
# Attempt to complete the rebase
bash scripts/fix-rebase.sh

# Or, prefer to abort the rebase safely
bash scripts/fix-rebase.sh --abort
```

The script will:
1. Detect if you're in a rebase state
2. Check for conflicts
3. Guide you through resolution or safely abort
4. Verify synchronization with origin
5. Offer to push changes

### Manual Resolution

If you prefer manual control, follow these steps:

#### Step 1: Check Rebase State

```bash
git status
git rev-parse --abbrev-ref HEAD
```

Look for: `"You are currently rebasing branch 'X' on 'Y'"`

#### Step 2: Check for Conflicts

```bash
git diff --name-only --diff-filter=U
```

- **If conflicts exist**: Resolve them, then `git add` each file
- **If no conflicts**: Proceed to continue/skip

#### Step 3: Continue or Skip

```bash
# Try to continue
git rebase --continue

# If it says "No changes - did you forget to use 'git add'?"
git rebase --skip
```

Repeat until rebase completes.

#### Step 4 (Fallback): Abort if Needed

If the rebase becomes too complex:

```bash
git rebase --abort
git status  # Verify you're back to normal
```

#### Step 5: Push Changes

```bash
# Try normal push first
git push origin main

# If rejected due to rewritten history
git push --force-with-lease origin main
```

⚠️ **Use `--force-with-lease` carefully** — it's safer than `--force` but still rewrites history.

#### Step 6: Verify

```bash
# Check git state
git status

# Verify sync with remote
git rev-list --count origin/main..HEAD
# Should return: 0
```

## Resolving Conflicts

When conflicts occur:

1. **Open the conflicted file** in your editor
2. **Look for conflict markers**:
   ```
   <<<<<<< HEAD
   (current branch changes)
   =======
   (incoming changes)
   >>>>>>> commit-message
   ```
3. **Choose which changes to keep** or merge them manually
4. **Remove all conflict markers** (`<<<<<<<`, `=======`, `>>>>>>>`)
5. **Stage the resolved file**:
   ```bash
   git add path/to/resolved-file.ext
   ```
6. **Continue the rebase**:
   ```bash
   git rebase --continue
   ```

### Editor Handling

If nano or vim opens for a commit message:

**Nano**:
- Save: `Ctrl+O`, then `Enter`
- Exit: `Ctrl+X`

**Vim**:
- Save and quit: `:wq`
- Quit without saving: `:q!`

## Safety Guidelines

### DO:
- ✅ Use `--force-with-lease` instead of `--force` for safer force pushes
- ✅ Verify your changes before force pushing
- ✅ Communicate with your team before rewriting shared history
- ✅ Back up important branches before complex rebases

### DON'T:
- ❌ Force push to main/master without team coordination
- ❌ Rebase commits that have been pushed to shared branches (unless coordinated)
- ❌ Continue rebasing if you're unsure — abort and ask for help
- ❌ Use `--force` unless absolutely necessary

## Verification Report

After resolving rebase issues, refer to `REBASE_VERIFICATION_REPORT.md` for:
- Detailed verification steps
- Expected outputs for each command
- Health endpoint testing procedures
- Repository state assessment

## Health Endpoint Verification

After resolving Git issues, verify the application is working:

### Start the Server

```bash
# Development mode
npm install  # If not already done
npm run dev

# Production mode
npm run build
npm run start
```

### Test Health Endpoints

#### Basic Health Check:
```bash
curl -sS http://localhost:5000/health | python -m json.tool
```

Expected response:
```json
{
  "ok": true,
  "db": true,
  "uptime": 123.456
}
```

#### CI Health Check:
```bash
curl -sS http://localhost:5000/api/ci/health | python -m json.tool
```

Expected response:
```json
{
  "ok": true,
  "jobs": {
    "READY": 0,
    "LEASED": 0,
    "DONE": 5,
    "DEAD": 0
  },
  "last_completed": {
    "id": "uuid-here",
    "status": "SUCCEEDED",
    "finished_at": "2026-02-15T12:00:00.000Z",
    "repo": "owner/repo"
  },
  "ciTmpDir": "/tmp/ci",
  "ciTmpDirFreeBytes": 1234567890,
  "ciTmpDirLowDisk": false
}
```

## Troubleshooting

### Issue: "Not currently on any branch"

```bash
git checkout main  # or your target branch
```

### Issue: "Cannot rebase with uncommitted changes"

```bash
# Stash your changes
git stash

# Then proceed with rebase
git rebase --continue

# After rebase completes, restore changes
git stash pop
```

### Issue: "Repository is locked"

```bash
# Check for stale lock files
ls .git/*.lock
ls .git/refs/heads/*.lock

# Remove if safe (make sure no git process is running)
rm .git/index.lock
```

### Issue: "Already up to date"

Your branch is already synchronized. No action needed.

## Emergency Contacts

If you encounter a complex rebase situation:

1. **Save your work**: Create a backup branch
   ```bash
   git branch backup-$(date +%Y%m%d-%H%M%S)
   ```

2. **Document the state**: Capture output
   ```bash
   git status > rebase-state.txt
   git log --oneline -20 >> rebase-state.txt
   ```

3. **Abort safely**:
   ```bash
   git rebase --abort
   ```

4. **Seek help**: Share the documentation with your team

## Additional Resources

- [Git Rebase Documentation](https://git-scm.com/docs/git-rebase)
- [Atlassian Git Rebase Tutorial](https://www.atlassian.com/git/tutorials/rewriting-history/git-rebase)
- Repository-specific: `REBASE_VERIFICATION_REPORT.md`

## Script Reference

### `scripts/fix-rebase.sh`

**Usage**:
```bash
bash scripts/fix-rebase.sh [OPTIONS]
```

**Options**:
- `--abort` — Prefer aborting rebase over completing it

**Features**:
- ✅ Automatic rebase state detection
- ✅ Conflict detection and guidance
- ✅ Interactive prompts for safety
- ✅ Color-coded output
- ✅ Smart push with `--force-with-lease` fallback
- ✅ Final verification checks

**Exit Codes**:
- `0` — Success (clean state or rebase resolved)
- `1` — Requires manual intervention (conflicts unresolved)

---

**Last Updated**: 2026-02-15  
**Maintainer**: GitHub Copilot Agent  
**Version**: 1.0
