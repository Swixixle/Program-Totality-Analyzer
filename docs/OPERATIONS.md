# Operations Guide

Quick reference for deploying, monitoring, and maintaining PTA in production.

## Health Checks

### Server Health Endpoint

```bash
curl http://localhost:5000/api/health
```

**Response** (HTTP 200 when healthy):
```json
{
  "status": "ok",
  "timestamp": "2026-02-17T00:00:00.000Z",
  "uptime": 3600,
  "db": "connected",
  "ci_worker": "enabled"
}
```

### CI Worker Status

```bash
curl http://localhost:5000/api/ci/health
```

**Response**:
```json
{
  "status": "ok",
  "ciTmpDir": "/tmp/ci",
  "ciTmpDirFreeBytes": 10737418240,
  "ciTmpDirLowDisk": false,
  "jobCounts": {
    "QUEUED": 0,
    "IN_PROGRESS": 1,
    "DONE": 42
  }
}
```

**Alert on**: `ciTmpDirLowDisk: true` or high `QUEUED` count

## Boot Report

On startup, the server logs a JSON boot report. Example:

```json
{
  "timestamp": "2026-02-17T03:00:00.000Z",
  "tool_version": "pta-1.0.0",
  "node_env": "production",
  "bind_host": "0.0.0.0",
  "bind_port": 5000,
  "db_configured": true,
  "ci_enabled": true,
  "semantic_enabled": false,
  "force_http": false
}
```

**Monitor this log line** on every deployment to verify configuration.

## Log Locations

| Component | Location | Format |
|-----------|----------|--------|
| Server logs | stdout/stderr | JSON + text |
| CI worker logs | stdout (tagged `[CI Worker]`) | Text |
| Analyzer logs | stdout (tagged `[CI Analyzer <runId>]`) | Text |
| Boot report | stdout (first line) | JSON |

**Best practice**: Send stdout/stderr to structured logging system (e.g., CloudWatch, Datadog, ELK).

## Smoke Test

Run the included smoke test to validate analyzer functionality:

```bash
npm run smoke
# or
bash scripts/smoke_pta.sh
```

**Expected**: Green checkmarks for all outputs (operate.json, target_howto.json, etc.)

## Common Operations

### Restart Server

```bash
# Graceful restart (Docker/k8s)
kubectl rollout restart deployment/pta-server

# Process manager (PM2/systemd)
pm2 restart pta-server
systemctl restart pta.service
```

### Clear CI Job Queue

```bash
# SQL query to purge old failed jobs
psql $DATABASE_URL -c "DELETE FROM ci_jobs WHERE status = 'DEAD' AND created_at < NOW() - INTERVAL '7 days';"
```

### Check CI Worker Disk Usage

```bash
du -sh /tmp/ci
df -h /tmp
```

**If disk full**:
1. Stop CI worker (`CI_WORKER_ENABLED=false`)
2. Clean up `/tmp/ci/*`
3. Reduce `MAX_REPO_BYTES` if needed
4. Restart worker

### Rotate Secrets

**API Keys**:
1. Generate new key: `openssl rand -hex 32`
2. Update `ADMIN_KEY` environment variable
3. Restart server
4. Update client configurations

**GitHub Token**:
1. Revoke old token in GitHub settings
2. Generate new token with same scopes
3. Update `GITHUB_TOKEN` environment variable
4. Restart server

## Monitoring Metrics

### Key Metrics to Track

| Metric | Alert Threshold | Action |
|--------|----------------|--------|
| CI job queue size | > 100 queued jobs | Scale workers or increase timeout |
| Analyzer timeout rate | > 10% of jobs | Review `ANALYZER_TIMEOUT_MS` or repo limits |
| Disk usage (`CI_TMP_DIR`) | > 90% | Clean workdirs, reduce `MAX_REPO_BYTES` |
| Failed job rate | > 20% | Investigate error codes in `ci_runs.error` |
| Server response time | p95 > 2s | Check DB connections, scale app tier |

### Error Code Distribution

Query CI error codes to identify patterns:

```sql
SELECT 
  LEFT(error, POSITION(':' IN error) - 1) AS error_code,
  COUNT(*) as count
FROM ci_runs
WHERE status = 'FAILED' AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_code
ORDER BY count DESC;
```

**Common error codes**:
- `REPO_TOO_LARGE`: Repo exceeds size limit (expected for very large repos)
- `ANALYZER_TIMEOUT`: Job took > 10 minutes (review timeout or repo complexity)
- `WORKDIR_INVALID`: Security validation failed (investigate immediately)

See [CI Error Codes](../server/ci-error-codes.ts) for full list.

## Upgrade Steps

### Minor Version Upgrade (e.g., 1.0.0 → 1.1.0)

1. **Backup database**: `pg_dump $DATABASE_URL > backup.sql`
2. **Review changelog**: Check for breaking changes (should be none)
3. **Update container image** or pull latest code
4. **Restart server**: `kubectl rollout restart deployment/pta-server`
5. **Verify boot report**: Check `tool_version` matches expected version
6. **Run smoke test**: `npm run smoke`
7. **Monitor logs**: Watch for errors in first 10 minutes

### Major Version Upgrade (e.g., 1.x → 2.0)

1. **Read migration guide**: Major versions may have breaking changes
2. **Test in staging**: Full end-to-end test in non-production environment
3. **Run database migrations**: If schema changes required
4. **Schedule maintenance window**: Coordinate with users
5. **Deploy new version**: Follow minor upgrade steps
6. **Validate outputs**: Ensure schema versions updated correctly
7. **Update client integrations**: If output format changed

## Troubleshooting

### Server won't start

**Check logs for**:
- `Invalid PORT`: Set valid `PORT` (1-65535)
- `DATABASE_URL is required`: Set `DATABASE_URL` in production
- `ADMIN_KEY must be at least 32 characters`: Generate proper key

### CI jobs stuck in QUEUED

**Possible causes**:
1. CI worker not enabled: Set `CI_WORKER_ENABLED=true`
2. Worker crashed: Check logs for exceptions
3. Database connection lost: Verify `DATABASE_URL`

**Resolution**:
```bash
# Check worker status
curl http://localhost:5000/api/ci/health

# Restart if needed
pm2 restart pta-server
```

### High memory usage

**Common causes**:
1. Large repo analysis: Reduce `MAX_REPO_BYTES`
2. Memory leak: Check for unclosed connections
3. LLM API slow responses: Review `AI_INTEGRATIONS_OPENAI_BASE_URL`

**Mitigation**:
- Set container memory limits
- Enable Node.js heap size limit: `--max-old-space-size=2048`
- Review analyzer memory usage in long-running jobs

### Analyzer produces invalid output

**Symptoms**: `ANALYZER_SCHEMA_INVALID` errors

**Check**:
1. Schema files present in `shared/schemas/`
2. No duplicate schema directories (should be only one)
3. Schema version matches tool version

**Resolution**:
```bash
# Validate schema location
ls -la shared/schemas/

# Run validator
python -m server.analyzer.src.validate_outputs out/ci/<run_id>
```

## Security Incident Response

### Suspected path traversal attack

1. **Immediate**: Stop CI worker
2. **Investigate**: Check logs for `WORKDIR_ESCAPE` errors
3. **Verify**: Review `ci_runs` table for suspicious repos
4. **Patch**: Update workdir validation if bypass found
5. **Report**: File security advisory on GitHub

### Secret exposure in logs

1. **Immediate**: Rotate exposed secrets
2. **Audit**: Check for unauthorized access using leaked credentials
3. **Remediate**: Update log sanitization in `ci-worker.ts`
4. **Monitor**: Watch for abuse of leaked secrets

## Support

- **Documentation**: [docs/](../docs/)
- **Issues**: GitHub Issues
- **Security**: GitHub Security Advisories (private)

## See Also

- [Configuration Guide](./CONFIGURATION.md)
- [Security Model](./SECURITY.md)
- [API Documentation](./API.md)
- [Deployment Guide](./DEPLOYMENT.md)
