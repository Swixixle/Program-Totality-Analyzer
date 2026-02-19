# Security Model & Threat Analysis

This document describes the security architecture, threat model, and execution boundary guarantees of the RR (Repository Reconnaissance) system.

## Security Architecture

### Defense in Depth

RR implements multiple layers of security controls:

1. **Input Validation**: All external inputs validated and sanitized
2. **Execution Isolation**: Analyzer runs in controlled subprocess with strict boundaries
3. **Resource Limits**: DoS protection through repo size and file count limits
4. **Path Containment**: Workdir isolation prevents directory traversal
5. **No Shell Execution**: Direct process spawn eliminates shell injection vectors
6. **Secret Management**: Environment-based secrets, never in code or logs

### Trust Boundaries

```
┌─────────────────────────────────────────────────┐
│ Trusted: RR Server Process                     │
│  - Configuration validation                      │
│  - Auth/API key checks                          │
│  - Database access                              │
└─────────────────┬───────────────────────────────┘
                  │
                  │ subprocess spawn (controlled)
                  ▼
┌─────────────────────────────────────────────────┐
│ Sandboxed: Python Analyzer Process              │
│  - Isolated workdir (CI_TMP_DIR)                │
│  - No network access (by policy)                │
│  - Resource limits enforced                     │
│  - Read-only access to repo clone               │
└─────────────────┬───────────────────────────────┘
                  │
                  │ cloned repo (untrusted input)
                  ▼
┌─────────────────────────────────────────────────┐
│ Untrusted: Repository Content                   │
│  - Size limits enforced                         │
│  - Symlinks rejected                            │
│  - Path escapes blocked                         │
│  - Static analysis only (no code execution)     │
└─────────────────────────────────────────────────┘
```

## Threat Model

### In-Scope Threats (Mitigated)

#### T1: Remote Code Execution (RCE)

**Attack Vector**: Malicious repo with crafted filenames or content attempting to execute arbitrary code

**Mitigations**:
- ✅ No shell execution (`shell: false` on all `spawn` calls)
- ✅ Arguments passed as array, never string concatenation
- ✅ Static analysis only - repo code is never executed
- ✅ Path validation prevents directory traversal
- ✅ Symlinks rejected during scanning

**Risk Level**: LOW (after mitigations)

#### T2: Denial of Service (DoS)

**Attack Vector**: Extremely large repo or repo with millions of tiny files

**Mitigations**:
- ✅ `MAX_REPO_BYTES` limit (default 250 MB)
- ✅ `MAX_FILE_COUNT` limit (default 50,000 files)
- ✅ `MAX_SINGLE_FILE_BYTES` limit (default 5 MB per file)
- ✅ `ANALYZER_TIMEOUT_MS` hard timeout (default 10 minutes)
- ✅ Low disk space detection fails jobs early

**Risk Level**: LOW (after mitigations)

#### T3: Path Traversal / Workdir Escape

**Attack Vector**: Malicious repo with symlinks or `..` paths attempting to read/write outside workdir

**Mitigations**:
- ✅ All work happens under `CI_TMP_DIR`
- ✅ `validateWorkdir()` checks realpath containment
- ✅ Symlinks detected and rejected
- ✅ `..` in paths rejected
- ✅ Fresh workdir created per job

**Risk Level**: LOW (after mitigations)

#### T4: Secret Leakage

**Attack Vector**: Secrets exposed in logs, outputs, or error messages

**Mitigations**:
- ✅ Git URLs sanitized in logs (credentials masked)
- ✅ Environment variables not echoed in error messages
- ✅ No `.env` files in production (platform secrets only)
- ✅ Health endpoints don't expose secrets
- ✅ Database URLs sanitized in error outputs

**Risk Level**: LOW (after mitigations)

#### T5: Unauthorized Access

**Attack Vector**: API endpoints accessed without proper authentication

**Mitigations**:
- ✅ `API_KEY` / `ADMIN_KEY` required in production
- ✅ Minimum key length enforced (32 characters)
- ⚠️ **P1 Enhancement**: RBAC and role-based access (planned)

**Risk Level**: MEDIUM (will be LOW after RBAC implementation)

### Out-of-Scope Threats

These threats are **not** mitigated by RR and must be addressed at deployment level:

- **Network-level attacks**: DDoS, packet injection (use CDN, firewall)
- **Compromised dependencies**: Supply chain attacks (use dependabot, audits)
- **Database compromise**: SQL injection, privilege escalation (Drizzle ORM prevents most SQL injection)
- **Insider threats**: Malicious admin actions (audit logging provides accountability)

## Execution Boundary Guarantees

### Analyzer Subprocess Isolation

**Guarantee 1**: No shell execution ever
- All subprocess spawns use `shell: false`
- Static test prevents regression
- Arguments passed as array, never concatenated

**Guarantee 2**: Strict workdir containment
- Analyzer cannot read/write outside `CI_TMP_DIR`
- Symlinks rejected
- `..` escapes blocked
- Realpath validation enforced

**Guarantee 3**: Resource limits enforced
- Repo size capped at `MAX_REPO_BYTES`
- File count capped at `MAX_FILE_COUNT`
- Single file size capped at `MAX_SINGLE_FILE_BYTES`
- Timeout enforced via `SIGKILL` after `ANALYZER_TIMEOUT_MS`

**Guarantee 4**: No code execution
- Analyzer performs **static analysis only**
- Repository code is never executed
- Dependencies not installed from analyzed repo

## Security Best Practices

### For Deployment

1. **Always use HTTPS**: Set `FORCE_HTTP=false` or omit entirely
2. **Strong secrets**: Use cryptographically random keys (≥32 chars)
3. **Platform secrets**: Never deploy `.env` files, use platform secret management
4. **Firewall CI worker**: Ensure analyzer has no outbound network access
5. **Monitor disk usage**: Alert on low disk space in `CI_TMP_DIR`
6. **Rotate keys**: Regularly rotate `ADMIN_KEY` and `GITHUB_TOKEN`

### For Development

1. **Use `.env` for local secrets**: Never commit to git
2. **Test with malicious inputs**: Use smoke tests and fuzz testing
3. **Review PRs for security**: Check for shell execution, path manipulation
4. **Run static security tests**: `npm test` includes security checks
5. **Keep dependencies updated**: Use `npm audit` and `pip-audit`

## Security Testing

### Static Analysis

- TypeScript type checking (`npm run check`)
- Static security tests (`server/__tests__/ci-worker-security.test.ts`)
- Grep for dangerous patterns (shell: true, exec())

### Dynamic Analysis

- Smoke tests with tiny repo (`npm run smoke`)
- Schema validation tests
- Path traversal tests (manual)
- DoS limit tests (manual)

### Vulnerability Scanning

- `npm audit` for Node.js dependencies
- `pip-audit` for Python dependencies (when available)
- CodeQL for static code analysis (configure in repository settings)
- GitHub Dependabot alerts

## Incident Response

### If RCE Suspected

1. **Immediately**: Stop all CI workers
2. **Investigate**: Review recent job logs and analyzer outputs
3. **Isolate**: Rotate all keys, review access logs
4. **Patch**: Deploy fix and re-scan all repos
5. **Notify**: Inform affected users if data was accessed

### If DoS Detected

1. **Mitigate**: Reduce `MAX_REPO_BYTES` and `MAX_FILE_COUNT` temporarily
2. **Block**: Identify and block offending repos/users
3. **Scale**: Add more worker capacity if legitimate traffic
4. **Review**: Adjust limits based on attack patterns

### If Secrets Leaked

1. **Rotate**: Immediately rotate leaked credentials
2. **Audit**: Check for unauthorized access using leaked secrets
3. **Review**: Identify root cause (log leak, error message, etc.)
4. **Fix**: Deploy sanitization fix
5. **Monitor**: Watch for abuse of leaked secrets

## Security Contacts

Report security issues to:
- GitHub Security Advisories (preferred)
- Repository maintainers (via private issue)

**Do NOT** open public issues for security vulnerabilities.

## Changelog

| Date | Change | Impact |
|------|--------|--------|
| 2026-02-17 | Initial security model document | Baseline |
| 2026-02-17 | Added execution boundary hardening | RCE risk: HIGH → LOW |
| 2026-02-17 | Added repo ingestion limits | DoS risk: HIGH → LOW |
| 2026-02-17 | Added workdir validation | Path traversal risk: MEDIUM → LOW |
| 2026-02-17 | Added normalized error codes | Improved incident response |
| 2026-02-17 | AST-based spawn security checker | Prevents security regressions |

## Security Guarantees and Limitations

### What This System PREVENTS

✅ **Shell Injection**: All subprocess spawns use `shell: false` with validated args arrays. No user input reaches shell interpreter.

✅ **Directory Traversal**: Workdir validation using `realpath()` ensures all file operations stay within `CI_TMP_DIR`. Both `..` paths and symlink escapes are blocked.

✅ **Arbitrary Code Execution**: Repository code is never executed. Analysis is static-only - we read files, never run them.

✅ **DoS via Large Repos**: Hard limits on repo size (250 MB), file count (50K), and single file size (5 MB) prevent resource exhaustion.

✅ **Timeout Attacks**: Hard timeout (default 10 minutes) kills runaway analyzer processes.

✅ **Secret Leakage in Logs**: Git URLs sanitized to mask credentials. Health endpoints don't expose secrets.

✅ **Schema Drift**: Single canonical schema directory (`shared/schemas`) with validation to prevent inconsistent output formats.

### What This System DOES NOT Prevent

❌ **Malicious File Content**: While we don't execute code, we do READ all files. A file with billions of newlines or crafted patterns could still cause high memory usage in the analyzer.

❌ **Supply Chain Attacks**: We don't validate npm/pip packages themselves. If your repo's dependencies have vulnerabilities, we'll report them, but won't block them.

❌ **Data Exfiltration via LLM**: When semantic analysis is enabled (`AI_INTEGRATIONS_OPENAI_API_KEY` set), code snippets are sent to the configured LLM API. This is opt-in and requires explicit configuration.

❌ **Availability Guarantees**: No SLA. A malicious repo could still consume worker time up to the timeout. Multiple such requests could exhaust worker capacity.

❌ **Perfect Accuracy**: Output quality depends on static analysis heuristics and (optionally) LLM quality. False positives and false negatives are expected.

❌ **Network-based Attacks**: The analyzer process doesn't enforce network isolation at the OS level. It SHOULD NOT make network requests, but we don't currently use seccomp or containers to enforce this.

❌ **Privilege Escalation**: We don't run the analyzer in a separate user context or container. It runs as the same user as the Node.js server.

### Attack Surface Summary

| Component | Trust Level | Attack Surface |
|-----------|-------------|----------------|
| Node.js Server | Trusted | API endpoints, auth bypass |
| Python Analyzer | Semi-trusted | Code parsing bugs, regex DoS |
| Repository Content | Untrusted | Malformed files, symlinks, crafted patterns |
| LLM API (optional) | External | Data leakage, model manipulation |

**Deployment Recommendation**: Run RR in a containerized environment with resource limits, network policies, and separate user accounts for defense-in-depth.

## Future Enhancements

Planned security improvements (Priority 1):

- [ ] **RBAC**: Role-based access control with Bearer tokens
- [ ] **Audit logging**: Actor-bound audit trail for privileged actions
- [ ] **Rate limiting**: Per-user/IP rate limits on API endpoints
- [ ] **Sandboxing**: OS-level sandboxing (containers, seccomp, etc.)
- [ ] **Network isolation**: Enforce no network access for analyzer process

See [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) for full roadmap.
