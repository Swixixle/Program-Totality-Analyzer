# Disaster Recovery Guide

This document covers backup, restore, and validation procedures for Asset-Analyzer.

## Overview

Asset-Analyzer stores two types of critical data:

1. **PostgreSQL Database**: CI runs, jobs, and metadata
2. **File System**: Analysis artifacts in `out/ci/` directory

Both must be backed up regularly and tested for restoration.

## Database Backup

### Automated Daily Backup

#### Using pg_dump (Recommended)

Create a backup script `/opt/asset-analyzer/scripts/backup-db.sh`:

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/opt/asset-analyzer/backups/db"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/pta_backup_$TIMESTAMP.sql.gz"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Perform backup
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"

# Verify backup file exists and is not empty
if [ ! -s "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file is empty or does not exist"
    exit 1
fi

echo "Backup created: $BACKUP_FILE"

# Remove backups older than retention period
find "$BACKUP_DIR" -name "pta_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Upload to cloud storage (optional, recommended)
# aws s3 cp "$BACKUP_FILE" s3://your-backup-bucket/pta-backups/
# gcloud storage cp "$BACKUP_FILE" gs://your-backup-bucket/pta-backups/
```

Make it executable and schedule with cron:

```bash
chmod +x /opt/asset-analyzer/scripts/backup-db.sh

# Add to crontab (runs daily at 2 AM)
crontab -e
# Add line:
0 2 * * * /opt/asset-analyzer/scripts/backup-db.sh >> /var/log/pta-backup.log 2>&1
```

#### Using Managed Database Backups

If using a managed PostgreSQL service:

**AWS RDS:**
- Enable automated backups (1-35 day retention)
- Take manual snapshots before major changes
- Enable point-in-time recovery (PITR)

**Google Cloud SQL:**
- Enable automated backups with 7-30 day retention
- Schedule additional on-demand backups
- Use read replicas for high availability

**Neon/Heroku:**
- Enable continuous protection
- Schedule manual snapshots via CLI

### Manual Backup

```bash
# Full database dump
pg_dump "$DATABASE_URL" > pta_backup_$(date +%Y%m%d).sql

# Compressed dump
pg_dump "$DATABASE_URL" | gzip > pta_backup_$(date +%Y%m%d).sql.gz

# Custom format (faster restore, parallel support)
pg_dump -Fc "$DATABASE_URL" > pta_backup_$(date +%Y%m%d).dump
```

## File System Backup

### Analysis Artifacts Backup

Create `/opt/asset-analyzer/scripts/backup-artifacts.sh`:

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/opt/asset-analyzer/backups/artifacts"
ARTIFACTS_DIR="/opt/asset-analyzer/out"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/artifacts_$TIMESTAMP.tar.gz"

mkdir -p "$BACKUP_DIR"

# Create compressed archive
tar -czf "$BACKUP_FILE" -C /opt/asset-analyzer out/

echo "Artifacts backup created: $BACKUP_FILE"

# Upload to cloud storage
# aws s3 cp "$BACKUP_FILE" s3://your-backup-bucket/pta-artifacts/
# gcloud storage cp "$BACKUP_FILE" gs://your-backup-bucket/pta-artifacts/

# Remove local backups older than 7 days (artifacts are large)
find "$BACKUP_DIR" -name "artifacts_*.tar.gz" -mtime +7 -delete
```

**Note:** Analysis artifacts can be large. Consider:
- Only backing up recent runs (last 30 days)
- Storing backups in object storage (S3, GCS)
- Implementing lifecycle policies for old backups

### Selective Backup (Recent Runs Only)

```bash
# Backup only runs from last 30 days
find /opt/asset-analyzer/out/ci -type d -name "run-*" -mtime -30 | \
  tar -czf artifacts_recent.tar.gz -T -
```

## Database Restore

### Prerequisites

1. Stop the Asset-Analyzer service:
```bash
# Docker
docker-compose down

# Systemd
sudo systemctl stop asset-analyzer
```

2. Verify backup file integrity:
```bash
gunzip -t pta_backup_20260217.sql.gz
```

### Restore from pg_dump

```bash
# Decompress backup
gunzip pta_backup_20260217.sql.gz

# Drop existing database (WARNING: destructive)
dropdb -U postgres asset_analyzer

# Create fresh database
createdb -U postgres asset_analyzer

# Restore from backup
psql "$DATABASE_URL" < pta_backup_20260217.sql
```

### Restore from Custom Format

```bash
# Custom format allows parallel restore
pg_restore -Fc -d "$DATABASE_URL" -j 4 pta_backup_20260217.dump
```

### Restore to Different Database (Testing)

```bash
# Create test database
createdb -U postgres asset_analyzer_test

# Restore to test database
psql "postgresql://user:pass@localhost/asset_analyzer_test" < backup.sql

# Test queries
psql "postgresql://user:pass@localhost/asset_analyzer_test" -c "SELECT COUNT(*) FROM ci_runs;"
```

## File System Restore

```bash
# Stop service first
sudo systemctl stop asset-analyzer

# Clear existing artifacts (optional)
rm -rf /opt/asset-analyzer/out/*

# Extract backup
tar -xzf artifacts_20260217.tar.gz -C /opt/asset-analyzer/

# Restore permissions
chown -R pta:pta /opt/asset-analyzer/out

# Start service
sudo systemctl start asset-analyzer
```

## Validation Procedures

After any restore, validate data integrity.

### Database Validation

Run `/opt/asset-analyzer/scripts/validate-restore.sh`:

```bash
#!/bin/bash
set -euo pipefail

echo "=== Database Validation ==="

# Test database connection
if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "ERROR: Cannot connect to database"
    exit 1
fi
echo "✓ Database connection successful"

# Check table counts
TABLES=("ci_runs" "ci_jobs")
for table in "${TABLES[@]}"; do
    COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM $table;")
    echo "✓ Table $table: $COUNT rows"
done

# Check for recent data
RECENT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM ci_runs WHERE created_at > NOW() - INTERVAL '7 days';")
echo "✓ Recent runs (last 7 days): $RECENT"

# Check job status distribution
echo "Job status distribution:"
psql "$DATABASE_URL" -c "SELECT status, COUNT(*) FROM ci_jobs GROUP BY status;"

# Test health endpoint
if curl -f http://localhost:5000/api/ci/health > /dev/null 2>&1; then
    echo "✓ Health endpoint responding"
else
    echo "✗ Health endpoint not responding"
fi

echo "=== Validation Complete ==="
```

### Artifact Validation

```bash
# Verify directory structure
if [ ! -d "/opt/asset-analyzer/out/ci" ]; then
    echo "ERROR: CI output directory missing"
    exit 1
fi

# Check for expected files in recent runs
find /opt/asset-analyzer/out/ci -name "operate.json" | head -5

# Verify file permissions
ls -la /opt/asset-analyzer/out/
```

### End-to-End Test

```bash
# Trigger a test analysis
curl -X POST http://localhost:5000/api/ci/enqueue \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "owner": "octocat",
    "repo": "Hello-World",
    "ref": "main"
  }'

# Wait 30 seconds
sleep 30

# Check job completed
curl http://localhost:5000/api/ci/health | jq '.jobs'
```

## Point-in-Time Recovery (PITR)

If using managed PostgreSQL with PITR enabled:

### AWS RDS

```bash
# Restore to specific timestamp
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier pta-prod \
  --target-db-instance-identifier pta-restore \
  --restore-time 2026-02-17T10:30:00Z
```

### Google Cloud SQL

```bash
gcloud sql backups restore $BACKUP_ID \
  --instance=pta-prod \
  --backup-instance=pta-prod
```

## Recovery Time Objectives (RTO)

Expected recovery times:

| Scenario | RTO | Notes |
|----------|-----|-------|
| Database restore (< 1GB) | 5-10 minutes | Using pg_restore |
| Database restore (> 10GB) | 30-60 minutes | Depends on size |
| Artifact restore | 10-30 minutes | Depends on artifact volume |
| Full system recovery | 1-2 hours | Database + artifacts + validation |

## Incident Response Integration

During an incident requiring restore:

1. **Alert stakeholders** (see [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md))
2. **Assess scope**: Determine what needs restoration
3. **Stop service**: Prevent further writes
4. **Restore data**: Follow procedures above
5. **Validate**: Run validation scripts
6. **Resume service**: Start Asset-Analyzer
7. **Monitor**: Watch for errors in logs
8. **Document**: Record RTO achieved and lessons learned

## Testing Your Backups

**Critical:** Test your backup and restore procedures quarterly.

### Quarterly Backup Drill

1. Create a test environment
2. Restore latest backup to test environment
3. Run validation procedures
4. Execute test analysis
5. Document time taken and issues encountered
6. Update procedures as needed

### Backup Test Checklist

- [ ] Latest database backup restores without errors
- [ ] Restored database contains expected tables and rows
- [ ] Recent runs (last 7 days) are present
- [ ] Application starts successfully with restored database
- [ ] Health endpoint returns OK
- [ ] Test analysis completes successfully
- [ ] Artifact files are readable and valid JSON

## Cloud Storage Integration

### AWS S3

```bash
# Install AWS CLI
pip install awscli

# Configure credentials
aws configure

# Backup script integration
aws s3 cp "$BACKUP_FILE" s3://your-backup-bucket/pta/db/
aws s3 cp "$ARTIFACTS_FILE" s3://your-backup-bucket/pta/artifacts/

# Restore from S3
aws s3 cp s3://your-backup-bucket/pta/db/latest.sql.gz ./
```

### Google Cloud Storage

```bash
# Install gcloud CLI
# Follow: https://cloud.google.com/sdk/docs/install

# Backup
gcloud storage cp "$BACKUP_FILE" gs://your-backup-bucket/pta/db/

# Restore
gcloud storage cp gs://your-backup-bucket/pta/db/latest.sql.gz ./
```

## Automated Recovery Script

Create `/opt/asset-analyzer/scripts/disaster-recovery.sh`:

```bash
#!/bin/bash
set -euo pipefail

BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file.sql.gz>"
    exit 1
fi

echo "=== DISASTER RECOVERY ==="
echo "Backup file: $BACKUP_FILE"
read -p "This will REPLACE the current database. Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

# Stop service
echo "Stopping service..."
sudo systemctl stop asset-analyzer

# Restore database
echo "Restoring database..."
gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"

# Validate
echo "Validating restore..."
bash /opt/asset-analyzer/scripts/validate-restore.sh

# Start service
echo "Starting service..."
sudo systemctl start asset-analyzer

echo "=== RECOVERY COMPLETE ==="
```

## Support

For recovery assistance:
- GitHub Issues: https://github.com/Swixixle/Asset-Analyzer/issues
- Emergency recovery: Consult [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md)
