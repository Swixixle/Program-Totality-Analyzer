# Quick Start Guide

Get Repository Reconnaissance (RR) running in 5 minutes.

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- **PostgreSQL** database (local or cloud)

## Installation

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/Swixixle/Repository-Reconnaissance.git
cd Repository-Reconnaissance

# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -e .
```

### 2. Configure Environment

Create a `.env` file or set environment variables:

```bash
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/repository_reconnaissance
API_KEY=your-secure-api-key-minimum-32-characters-long

# Optional
PORT=5000
NODE_ENV=development
GITHUB_WEBHOOK_SECRET=your-webhook-secret
GITHUB_TOKEN=your-github-token
```

**Security Note:** Generate a secure API_KEY:
```bash
openssl rand -hex 32
```

### 3. Initialize Database

```bash
npm run db:push
```

This creates the required tables and schema in your PostgreSQL database.

### 4. Run Development Server

```bash
npm run dev
```

The application starts on `http://localhost:5000` (or the PORT you specified).

## Verify Installation

### Run Smoke Test

The smoke test validates that the analyzer is working correctly:

```bash
npm run smoke
```

Expected output:
```
==> RR Smoke Test
Running analyzer on fixture repo...
✓ Both outputs exist
✓ operate.json validates against schema
✓ target_howto.json validates against schema
✓ All required metadata fields present
==> Smoke test PASSED ✅
```

If the smoke test passes, your installation is working correctly!

### Test the Health Endpoint

```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "checks": {
    "timestamp": "2026-02-17T00:00:00.000Z",
    "version": "1.0.0",
    "database": { "status": "ok" },
    "worker": { "status": "ok" },
    "disk": { "status": "ok" }
  }
}
```

### Run the Analyzer (Python CLI)

```bash
# Test with a sample project
rr analyze https://github.com/octocat/Hello-World -o ./test-output

# Check the output
ls -la test-output/
```

You should see:
- `operate.json` - Operational dashboard
- `DOSSIER.md` - Human-readable summary
- `claims.json` - Verifiable claims with evidence
- `coverage.json` - Scan metadata

## Next Steps

- **Production deployment**: See [docs/DEPLOYMENT.md](DEPLOYMENT.md)
- **API documentation**: See [docs/API.md](API.md)
- **Architecture overview**: See [docs/ARCHITECTURE.md](ARCHITECTURE.md)
- **GitHub webhook setup**: See [README.md](../README.md#live-static-ci-feed)

## Common Issues

### "DATABASE_URL must be set"

Ensure `DATABASE_URL` is set in your environment or `.env` file.

### "Port already in use"

Change the `PORT` environment variable to use a different port.

### Python module errors

Ensure you've installed the Python package:
```bash
pip install -e .
```

### Missing tables in database

Run the database migration:
```bash
npm run db:push
```
