# GitHub Authentication Setup for Replit

This guide explains how to configure Git authentication in Replit Shell so you can push and pull from GitHub **without** embedding your Personal Access Token (PAT) in the remote URL.

> **Note:** This guide uses `Swixixle/Asset-Analyzer` as an example repository. Replace with your actual repository URL where applicable.

## Quick Setup (Automated)

**Prerequisites:**
1. Create a GitHub Personal Access Token (PAT) with `repo` scope
   - Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate new token with at least `repo` scope
2. Add the token to Replit Secrets:
   - Click the lock icon (🔒) in the Replit sidebar
   - Add a new secret: `GITHUB_TOKEN` = your PAT

**Run the automated setup:**

```bash
bash scripts/setup-github-auth.sh
```

This script will:
1. ✓ Verify `GITHUB_TOKEN` exists in environment
2. ✓ Clean the remote URL (remove any embedded credentials)
3. ✓ Configure git credential helper
4. ✓ Write credentials securely to `~/.git-credentials`
5. ✓ Clear any stale git locks
6. ✓ Test authentication with `git fetch`
7. ✓ Display repository status

If successful, you can now use `git fetch`, `git push`, and other git operations normally.

## Manual Setup

If you prefer to set up authentication manually, follow these steps:

### Step 0: Verify Token

```bash
# Should print "Token exists"
[[ -n "${GITHUB_TOKEN:-}" ]] && echo "Token exists" || echo "Token not found"

# Show first 4 characters for verification
echo "${GITHUB_TOKEN:0:4}..."
```

If this shows "Token not found", add `GITHUB_TOKEN` to Replit Secrets first.

### Step 1: Clean Remote URL

```bash
# Remove any token-embedded origin URL
git remote set-url origin https://github.com/Swixixle/Asset-Analyzer.git
git remote -v
```

**Security Note:** Never store tokens directly in the remote URL. Always use credential storage.

### Step 2: Configure Credential Helper

```bash
git config --global credential.helper store
```

This tells git to store credentials in `~/.git-credentials`.

### Step 3: Write Credentials

```bash
printf "https://x-access-token:%s@github.com\n" "$GITHUB_TOKEN" > ~/.git-credentials
chmod 600 ~/.git-credentials
```

The credential format uses:
- **Username**: `x-access-token` (a common GitHub convention for PAT authentication)
- **Password**: Your `GITHUB_TOKEN` value

**Note:** GitHub accepts multiple authentication formats for HTTPS with PATs. This script uses `x-access-token` as the username, which is widely supported and recommended for Replit environments.

### Step 4: Clear Stale Locks

```bash
rm -f .git/index.lock .git/REBASE_HEAD.lock 2>/dev/null || true
```

This prevents "index.lock exists" errors common in Replit environments.

### Step 5: Test Authentication

```bash
git fetch origin
```

If this succeeds, authentication is working correctly.

### Step 6: Verify Status

```bash
git status
```

## Troubleshooting

### `git fetch` fails with authentication error

**Symptom:** Error message like "Authentication failed" or "could not read Username"

**Solutions:**

1. **Verify token is set:**
   ```bash
   echo "${GITHUB_TOKEN:0:4}..."
   ```
   This should print the first 4 characters of your token followed by `...`

2. **Check credential file:**
   ```bash
   ls -la ~/.git-credentials
   git config --global --get credential.helper
   ```
   - File should exist with `600` permissions
   - Credential helper should show `store`

3. **Verify remote URL:**
   ```bash
   git remote -v
   ```
   Should show `https://github.com/Swixixle/Asset-Analyzer.git` (no token embedded)

4. **Run debug block:**
   ```bash
   git remote -v
   ls -la ~/.git-credentials
   git config --global --get credential.helper
   echo "${GITHUB_TOKEN:0:4}..."
   ```

5. **Re-run setup:**
   ```bash
   bash scripts/setup-github-auth.sh
   ```

### Token has expired or is invalid

**Symptom:** Authentication fails even though setup looks correct

**Solution:** Generate a new GitHub PAT and update `GITHUB_TOKEN` in Replit Secrets, then re-run setup.

### "index.lock exists" error

**Symptom:** Git operations fail with message about `index.lock`

**Solution:**
```bash
rm -f .git/index.lock
```

Or run the full setup script which clears all locks automatically.

### Token appears in git URLs or logs

**CRITICAL SECURITY ISSUE:** If your token appears in any of these locations:
- Git remote URLs (`git remote -v`)
- Git logs or error messages
- Shell history

**Immediate action:**
1. **Revoke the exposed token** in GitHub settings immediately
2. Generate a new token
3. Clean the remote URL: `git remote set-url origin https://github.com/Swixixle/Asset-Analyzer.git`
4. Clear shell history if needed: `history -c`
5. Run `bash scripts/setup-github-auth.sh` with the new token

### Credential file permissions error

**Symptom:** Warnings about insecure credential file

**Solution:**
```bash
chmod 600 ~/.git-credentials
```

## How It Works

### Credential Storage

The `credential.helper=store` configuration tells git to save credentials in `~/.git-credentials` in plain text. The file format is:

```
https://x-access-token:YOUR_TOKEN_HERE@github.com
```

- **File location:** `~/.git-credentials` (user home directory)
- **Permissions:** `600` (read/write for owner only)
- **Format:** URL with embedded credentials

When git needs credentials for `https://github.com`, it reads this file and extracts the username (`x-access-token`) and password (your token).

### Security Considerations

1. **Secrets in environment:** `GITHUB_TOKEN` is stored in Replit Secrets, which are encrypted at rest and only exposed to your Repl
2. **Credential file security:** `~/.git-credentials` has `600` permissions (owner-only access)
3. **No tokens in URLs:** Remote URLs never contain credentials, preventing token exposure in logs
4. **Token scope:** Use minimal scope needed (usually just `repo` for private repository access)

### Alternative: SSH Keys

For production environments, consider using SSH keys instead of HTTPS + PAT:

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Add to GitHub: Settings → SSH and GPG keys

# Change remote to SSH
git remote set-url origin git@github.com:Swixixle/Asset-Analyzer.git
```

However, for Replit development, HTTPS + credential helper is simpler and recommended.

## Updating the Token

If you need to rotate your token:

1. **Generate new token** in GitHub
2. **Update Replit Secret:** Change `GITHUB_TOKEN` value
3. **Re-run setup:**
   ```bash
   bash scripts/setup-github-auth.sh
   ```

The script will overwrite `~/.git-credentials` with the new token.

## Security Best Practices

- ✓ **DO** use Replit Secrets for `GITHUB_TOKEN`
- ✓ **DO** run the setup script to configure credentials
- ✓ **DO** use minimal token scopes (e.g., `repo` only)
- ✓ **DO** rotate tokens periodically
- ✓ **DO** revoke tokens immediately if exposed

- ✗ **DON'T** embed tokens in git remote URLs
- ✗ **DON'T** commit tokens to source code
- ✗ **DON'T** share tokens in logs or messages
- ✗ **DON'T** use tokens with broader scope than needed
- ✗ **DON'T** reuse tokens across multiple projects

## Related Documentation

- [Git Credential Storage](https://git-scm.com/docs/git-credential-store)
- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [Replit Secrets](https://docs.replit.com/programming-ide/workspace-features/secrets)
- Repository stability: `docs/REBASE_RESOLUTION_GUIDE.md`
