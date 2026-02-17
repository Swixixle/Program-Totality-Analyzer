# Security Configuration Guide

## Required Environment Variables

### Production Environment

The following environment variables are **required** in production:

```bash
# API Authentication - Required for all API endpoints
API_KEY=your-secure-random-key-here

# Admin Authentication - Required for admin endpoints
ADMIN_KEY=your-secure-admin-key-here

# GitHub Webhook Secret - Required if using CI features
GITHUB_WEBHOOK_SECRET=your-github-webhook-secret

# CORS Configuration - Comma-separated list of allowed origins
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

### Development Environment

In development, these are optional but recommended:

```bash
# Optional - If set, API authentication is enforced in dev too
API_KEY=dev-key

# Optional - If set, admin authentication is enforced in dev too
ADMIN_KEY=dev-admin-key

# Optional - CORS allows all localhost origins by default in dev
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5000
```

## Generating Secure Keys

Use these commands to generate secure random keys:

```bash
# Generate API_KEY (32 bytes, base64 encoded)
openssl rand -base64 32

# Generate ADMIN_KEY (32 bytes, base64 encoded)
openssl rand -base64 32
```

## API Authentication

All API endpoints require authentication via the `X-Api-Key` header:

```bash
curl -H "X-Api-Key: your-api-key" https://api.example.com/api/projects
```

### Protected Endpoints

The following endpoints require `X-Api-Key` authentication:

- `GET /api/projects` - List projects
- `POST /api/projects/create` - Create project
- `GET /api/projects/:id` - Get project
- `GET /api/projects/:id/analysis` - Get analysis
- `POST /api/projects/:id/analyze` - Start analysis
- `POST /api/projects/analyze-replit` - Analyze Replit workspace
- `GET /api/ci/runs` - List CI runs
- `GET /api/ci/runs/:id` - Get CI run
- `POST /api/ci/enqueue` - Enqueue CI job
- `POST /api/ci/worker/tick` - Process CI job
- `GET /api/ci/health` - CI health check

### Public Endpoints (Rate Limited)

- `GET /health` - Basic health check (30 req/min)
- `GET /api/health` - Detailed health (30 req/min, auth required for details)
- `GET /api/dossiers/lantern` - Public documentation (20 req/min)
- `POST /api/webhooks/github` - GitHub webhook (30 req/min, signed)

## Admin Authentication

Admin endpoints require the `X-Admin-Key` header:

```bash
curl -H "X-Admin-Key: your-admin-key" https://api.example.com/api/admin/analyzer-log
```

### Admin Endpoints

- `GET /api/admin/analyzer-log` - View analyzer logs (5 req/min)
- `POST /api/admin/analyzer-log/clear` - Clear logs (5 req/min)
- `POST /api/admin/reset-analyzer` - Reset analyzer (5 req/min)

## Rate Limits

Rate limits are automatically enforced per client:

| Endpoint Category | Rate Limit |
|------------------|------------|
| Admin endpoints | 5 requests per minute |
| Project API | 100 requests per minute |
| CI API | 50 requests per minute |
| Health checks | 30 requests per minute |
| GitHub webhook | 30 requests per minute |
| Dossier | 20 requests per minute |

When rate limited, you'll receive:
```json
{
  "error": "Rate limit exceeded"
}
```

## CORS Configuration

### Production

Only explicitly allowed origins can access the API. Configure via `ALLOWED_ORIGINS`:

```bash
ALLOWED_ORIGINS=https://app.example.com,https://dashboard.example.com
```

### Development

Localhost origins are automatically allowed:
- `http://localhost:*`
- `http://127.0.0.1:*`

## Security Headers

The following security headers are automatically set:

### Production
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` (strict)
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

### Development
Same headers but with relaxed CSP for hot reload and Vite.

## Webhook Security

GitHub webhooks are verified using HMAC-SHA256:

1. Set `GITHUB_WEBHOOK_SECRET` in your environment
2. Configure the same secret in GitHub webhook settings
3. All webhook requests are verified with `X-Hub-Signature-256` header

Invalid signatures are rejected with 401 Unauthorized.

## Error Handling

### Production
Generic error messages are returned:
```json
{
  "message": "Internal Server Error"
}
```

### Development
Detailed error messages are returned for debugging:
```json
{
  "message": "Database connection failed: ECONNREFUSED"
}
```

All errors are logged server-side regardless of environment.

## Security Best Practices

1. **Never commit secrets** - Use environment variables
2. **Rotate keys regularly** - Generate new API/admin keys periodically
3. **Use HTTPS in production** - Required for secure header transmission
4. **Monitor rate limits** - Watch for abuse patterns
5. **Review logs** - Check for authentication failures
6. **Keep dependencies updated** - Run `npm audit` regularly
7. **Test security locally** - Set API_KEY in dev to test auth flow

## Troubleshooting

### "Unauthorized" errors in production

Check that:
1. `API_KEY` or `ADMIN_KEY` is set in environment
2. You're sending the correct header (`X-Api-Key` or `X-Admin-Key`)
3. Key matches exactly (no extra spaces/newlines)

### "Rate limit exceeded" errors

Either:
1. Wait 60 seconds for the window to reset
2. Reduce request frequency
3. Batch operations when possible

### CORS errors in production

Ensure:
1. `ALLOWED_ORIGINS` includes your frontend domain
2. Protocol (http/https) matches exactly
3. No trailing slashes in origin URLs

### Health endpoint returns limited info

In production, detailed health info requires authentication:
```bash
curl -H "X-Api-Key: your-api-key" https://api.example.com/api/health
```

## Migration Guide

### Existing Deployments

If you're updating an existing deployment:

1. **Set required environment variables** before deploying:
   ```bash
   API_KEY=$(openssl rand -base64 32)
   ADMIN_KEY=$(openssl rand -base64 32)
   ```

2. **Update client applications** to send `X-Api-Key` header

3. **Update admin tools** to send `X-Admin-Key` header

4. **Configure CORS** via `ALLOWED_ORIGINS` if serving from different domain

5. **Test in staging** before production deployment

### Backward Compatibility

In development mode (NODE_ENV !== "production"):
- API endpoints work without API_KEY (but it's recommended)
- Admin endpoints work without ADMIN_KEY (but it's recommended)
- CORS allows localhost origins automatically

This ensures development workflow isn't disrupted.
