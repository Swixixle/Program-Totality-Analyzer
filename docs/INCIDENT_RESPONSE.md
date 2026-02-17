# Incident Response Guide

This document provides procedures for responding to security incidents, data breaches, and operational emergencies.

## Incident Classification

| Severity | Description | Response Time | Examples |
|----------|-------------|---------------|----------|
| **P0 - Critical** | Active security breach, data exposure, service down | Immediate (< 15 min) | API key compromised, database breach, service unavailable |
| **P1 - High** | Security vulnerability, data integrity issue | < 1 hour | Unauthorized access attempt, data corruption detected |
| **P2 - Medium** | Degraded service, non-critical security issue | < 4 hours | Performance degradation, suspicious activity |
| **P3 - Low** | Minor issues, potential vulnerabilities | < 24 hours | Log anomalies, configuration drift |

## Emergency Contacts

Maintain an up-to-date contact list:

```yaml
# Store in a secure location (e.g., password manager)
contacts:
  - role: "Incident Commander"
    name: "Your Name"
    phone: "+1-XXX-XXX-XXXX"
    email: "incidents@example.com"
  
  - role: "Database Admin"
    name: "DBA Name"
    phone: "+1-XXX-XXX-XXXX"
    email: "dba@example.com"
  
  - role: "Security Lead"
    name: "Security Name"
    phone: "+1-XXX-XXX-XXXX"
    email: "security@example.com"
```

## Common Incident Scenarios

### Scenario 1: API Key Compromise

**Indicators:**
- Unauthorized API requests from unknown IPs
- Spike in API usage
- Unusual CI job patterns
- Alert from security monitoring

**Immediate Actions (< 15 minutes):**

1. **Rotate the API key immediately:**

```bash
# Generate new API key
NEW_KEY=$(openssl rand -hex 32)

# Update environment
# Docker:
docker-compose down
# Update .env.production with new API_KEY
docker-compose up -d

# Systemd:
sudo systemctl stop asset-analyzer
# Update /opt/asset-analyzer/.env.production
sudo systemctl start asset-analyzer
```

2. **Invalidate old key in code:**

If API key validation is in code, deploy update:
```typescript
// Add to blocked keys list
const BLOCKED_KEYS = [
  "old-compromised-key-hash",
];
```

3. **Audit recent activity:**

```bash
# Check logs for suspicious activity
journalctl -u asset-analyzer --since "1 hour ago" | grep -i "api"

# Query database for recent runs
psql "$DATABASE_URL" -c "
  SELECT id, repo_owner, repo_name, created_at, status 
  FROM ci_runs 
  WHERE created_at > NOW() - INTERVAL '24 hours'
  ORDER BY created_at DESC;
"
```

4. **Update legitimate clients:**
- Notify all authorized users of new API key
- Update CI/CD pipelines
- Update monitoring tools
- Update documentation

**Investigation (< 2 hours):**

- Determine how key was compromised
- Check for data exfiltration
- Review access logs
- Identify affected resources

**Post-Incident:**

- Document timeline
- Update key rotation policy
- Consider implementing key scoping
- Review access control procedures

### Scenario 2: Database Compromise

**Indicators:**
- Unexpected database connections
- Data modification from unknown sources
- Database performance degradation
- Alert from database monitoring

**Immediate Actions (< 30 minutes):**

1. **Isolate the database:**

```bash
# AWS RDS: Modify security group to block all but emergency IP
aws ec2 revoke-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 5432 \
  --cidr 0.0.0.0/0

# Add only your emergency access IP
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 5432 \
  --cidr YOUR_IP/32
```

2. **Stop Asset-Analyzer service:**

```bash
# Prevent further database access
docker-compose down
# or
sudo systemctl stop asset-analyzer
```

3. **Take immediate backup:**

```bash
# Before any forensic work
pg_dump "$DATABASE_URL" | gzip > emergency_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

4. **Rotate database credentials:**

```bash
# PostgreSQL
psql "$DATABASE_URL" -c "ALTER USER pta_user WITH PASSWORD 'new-secure-password';"

# Update DATABASE_URL in environment
# Then restart service
```

**Investigation (< 4 hours):**

```sql
-- Check for unauthorized data access
SELECT * FROM pg_stat_activity ORDER BY query_start DESC LIMIT 20;

-- Review recent connections
SELECT * FROM pg_stat_database;

-- Check for data modification
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public';

-- Audit recent CI runs for suspicious patterns
SELECT repo_owner, repo_name, COUNT(*), MAX(created_at)
FROM ci_runs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY repo_owner, repo_name
ORDER BY COUNT(*) DESC;
```

**Containment:**

- Identify compromised accounts
- Audit all database users
- Review connection logs
- Check for data exfiltration

**Recovery:**

- Restore from last known good backup (see [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md))
- Verify data integrity
- Re-enable service with new credentials
- Monitor for recurrence

**Post-Incident:**

- Enable database audit logging
- Implement database encryption at rest
- Require SSL/TLS connections
- Set up database activity monitoring
- Review and harden access controls

### Scenario 3: Webhook Secret Compromise

**Indicators:**
- Fake webhook deliveries
- Spike in unauthorized webhook attempts
- GitHub reports suspicious activity

**Immediate Actions (< 15 minutes):**

1. **Generate new webhook secret:**

```bash
NEW_SECRET=$(openssl rand -hex 32)
```

2. **Update GitHub webhook configuration:**

- Go to Repository → Settings → Webhooks
- Edit the webhook
- Update Secret field with new value
- Save changes

3. **Update Asset-Analyzer environment:**

```bash
# Update GITHUB_WEBHOOK_SECRET in environment
# Restart service
docker-compose down && docker-compose up -d
# or
sudo systemctl restart asset-analyzer
```

4. **Verify webhook deliveries:**

- Check GitHub webhook delivery log
- Confirm 200 responses
- Monitor for 401 errors (would indicate config mismatch)

**Investigation:**

```bash
# Check for suspicious webhook activity
journalctl -u asset-analyzer | grep "webhook" | grep -E "(401|403)"

# Review recent CI runs for unauthorized triggers
psql "$DATABASE_URL" -c "
  SELECT repo_owner, repo_name, event_type, created_at
  FROM ci_runs
  WHERE created_at > NOW() - INTERVAL '24 hours'
  ORDER BY created_at DESC;
"
```

### Scenario 4: GitHub Token Compromise

**Indicators:**
- Unexpected repository clones
- GitHub security alert
- Token used from unknown location

**Immediate Actions (< 15 minutes):**

1. **Revoke compromised token in GitHub:**

- Go to GitHub → Settings → Developer settings → Personal access tokens
- Find the compromised token
- Click "Delete" or "Revoke"

2. **Generate new token:**

- Create new token with minimal required scopes (only `repo` for private repos)
- Set expiration date (recommend 90 days)
- Save securely

3. **Update Asset-Analyzer:**

```bash
# Update GITHUB_TOKEN in environment
docker-compose down
# Edit .env.production
docker-compose up -d
```

4. **Audit recent activity:**

```bash
# Check recent git clone operations
journalctl -u asset-analyzer | grep "git clone" | tail -20

# Review CI runs
psql "$DATABASE_URL" -c "
  SELECT repo_owner, repo_name, commit_sha, status
  FROM ci_runs
  WHERE created_at > NOW() - INTERVAL '48 hours';
"
```

### Scenario 5: Service Outage

**Indicators:**
- Health endpoint returns errors
- Application not responding
- 502/503 errors from reverse proxy
- CI jobs stuck in READY/LEASED status

**Immediate Actions (< 15 minutes):**

1. **Check service status:**

```bash
# Docker
docker-compose ps
docker-compose logs app --tail=50

# Systemd
sudo systemctl status asset-analyzer
journalctl -u asset-analyzer --since "10 minutes ago"
```

2. **Restart service:**

```bash
# Quick restart
docker-compose restart app
# or
sudo systemctl restart asset-analyzer
```

3. **Verify database connectivity:**

```bash
psql "$DATABASE_URL" -c "SELECT 1;"
```

4. **Check disk space:**

```bash
df -h
du -sh /opt/asset-analyzer/out/*
```

**Troubleshooting:**

```bash
# Check for stuck analyzer processes
ps aux | grep analyzer_cli
# Kill if necessary (replace PID)
kill -9 <PID>

# Check for port conflicts
netstat -tulpn | grep :5000

# Verify environment variables
docker-compose exec app env | grep -E "(DATABASE_URL|API_KEY|PORT)"

# Test health endpoint
curl http://localhost:5000/api/ci/health
```

**Recovery:**

- Clear stuck jobs if necessary
- Restart background worker
- Monitor logs for errors
- Verify CI jobs resume processing

## Data Breach Response

If sensitive data may have been exposed:

### Within 1 Hour

1. **Contain the breach:**
   - Isolate affected systems
   - Stop data exfiltration
   - Secure backup copies

2. **Assess scope:**
   - What data was accessed?
   - How many records affected?
   - What is the sensitivity level?

3. **Preserve evidence:**
   - Take system snapshots
   - Save logs before rotation
   - Document all actions taken

### Within 24 Hours

4. **Notify stakeholders:**
   - Internal security team
   - Management
   - Legal counsel

5. **Determine notification requirements:**
   - GDPR (72 hours for EU data)
   - CCPA (California residents)
   - Other applicable regulations

6. **Begin forensic investigation:**
   - Hire external experts if needed
   - Analyze attack vectors
   - Identify root cause

### Within 72 Hours

7. **Notify affected parties:**
   - Follow regulatory requirements
   - Provide clear information
   - Offer remediation steps

8. **Implement additional controls:**
   - Patch vulnerabilities
   - Enhance monitoring
   - Update security policies

## Log Retention and Evidence Preservation

### Retention Policy

| Log Type | Retention | Location |
|----------|-----------|----------|
| Application logs | 90 days | `/opt/asset-analyzer/out/_log/` |
| System logs (journald) | 30 days | `/var/log/journal/` |
| Database logs | 14 days | Managed service |
| Nginx access logs | 30 days | `/var/log/nginx/` |
| Audit logs | 1 year | Secure archive |

### Evidence Collection

During an incident, collect:

```bash
# System state
hostname > incident_evidence/hostname.txt
date > incident_evidence/timestamp.txt
uptime > incident_evidence/uptime.txt

# Application state
docker-compose logs app > incident_evidence/app_logs.txt
sudo systemctl status asset-analyzer > incident_evidence/service_status.txt

# Database state
psql "$DATABASE_URL" -c "\dt" > incident_evidence/db_tables.txt
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM ci_runs;" > incident_evidence/run_count.txt

# Network state
netstat -tulpn > incident_evidence/network.txt
ss -tulpn > incident_evidence/sockets.txt

# Process state
ps aux > incident_evidence/processes.txt

# Disk state
df -h > incident_evidence/disk.txt
du -sh /opt/asset-analyzer/* > incident_evidence/disk_usage.txt

# Archive evidence
tar -czf incident_evidence_$(date +%Y%m%d_%H%M%S).tar.gz incident_evidence/
```

## Communication Templates

### Internal Notification

```
SUBJECT: [P0 INCIDENT] Asset-Analyzer Security Incident

An incident has been detected with Asset-Analyzer:

Incident ID: INC-2026-02-17-001
Severity: P0 - Critical
Start Time: 2026-02-17 14:30 UTC
Status: Investigating

Description:
[Brief description of the incident]

Impact:
[What services/data are affected]

Actions Taken:
- [Action 1]
- [Action 2]

Next Steps:
- [Next action with timeline]

Incident Commander: [Name]
```

### External Notification (if required)

```
SUBJECT: Security Notice - Asset-Analyzer Service

We are writing to inform you of a security incident that may have affected 
your data in our Asset-Analyzer service.

What Happened:
[Clear, non-technical description]

What Information Was Involved:
[Specific data types affected]

What We Are Doing:
[Steps taken to address the issue]

What You Can Do:
[Recommended actions for users]

For More Information:
Contact: security@example.com
Reference: INC-2026-02-17-001
```

## Post-Incident Review

Within 7 days of incident resolution, conduct a post-mortem:

### Post-Mortem Template

```markdown
# Incident Post-Mortem: [Incident ID]

## Summary
- Incident ID: 
- Date/Time: 
- Duration: 
- Severity: 

## Timeline
- [Time] - Incident detected
- [Time] - Response initiated
- [Time] - Containment achieved
- [Time] - Service restored
- [Time] - Investigation complete

## Root Cause
[Detailed analysis of what caused the incident]

## Impact
- Systems affected: 
- Users affected: 
- Data affected: 
- Downtime: 

## Response Evaluation
What went well:
- [Item 1]

What could be improved:
- [Item 2]

## Action Items
- [ ] [Action 1] - Owner: [Name] - Due: [Date]
- [ ] [Action 2] - Owner: [Name] - Due: [Date]

## Lessons Learned
[Key takeaways and improvements to prevent recurrence]
```

## Preventive Measures

Regular security practices:

- **Weekly**: Review application logs for anomalies
- **Monthly**: Rotate API keys, update dependencies
- **Quarterly**: Test disaster recovery procedures, conduct security audit
- **Annually**: Penetration testing, incident response drill

## Security Monitoring Checklist

- [ ] Failed authentication attempts logged
- [ ] Unusual API usage patterns detected
- [ ] Database connection monitoring active
- [ ] Disk usage alerts configured
- [ ] Service health monitoring enabled
- [ ] Log aggregation and alerting setup
- [ ] Backup verification automated
- [ ] Security patch notifications enabled

## Support Resources

- **Documentation**: https://github.com/Swixixle/Asset-Analyzer/tree/main/docs
- **Security Issues**: security@example.com
- **Emergency Contact**: [Phone number]
- **GitHub Issues**: https://github.com/Swixixle/Asset-Analyzer/issues

---

**Remember**: In any security incident, transparency, speed, and thoroughness are critical. When in doubt, escalate.
