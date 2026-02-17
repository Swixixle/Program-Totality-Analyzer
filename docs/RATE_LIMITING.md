# Rate Limiting Guide

This document covers rate limiting strategies for Asset-Analyzer to prevent abuse and ensure service availability.

## Overview

Rate limiting is critical for:
- Preventing API abuse
- Protecting against DoS attacks
- Ensuring fair resource allocation
- Maintaining service quality

## Current Implementation

Asset-Analyzer includes **in-memory rate limiting** for critical endpoints. This provides basic protection but has limitations in multi-instance deployments.

### In-Memory Rate Limiter

Location: `server/routes.ts` - `createRateLimiter()` function

**Characteristics:**
- Per-instance memory storage
- Simple and fast
- No external dependencies
- Does not persist across restarts
- Not shared between instances

**Use Cases:**
- Single-instance deployments
- Development and testing
- Basic protection

## Production Rate Limiting Options

For production deployments, especially with multiple instances, choose one of these approaches:

### Option 1: Redis-Backed Rate Limiting (Recommended)

Use Redis for distributed rate limiting across multiple app instances.

#### Install Dependencies

```bash
npm install redis express-rate-limit rate-limit-redis
```

#### Configure Redis

**Docker Compose** - Add to `docker-compose.yml`:

```yaml
services:
  app:
    # ... existing config
    environment:
      REDIS_URL: redis://redis:6379
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

**Standalone Redis:**

```bash
# Install Redis
sudo apt-get install redis-server

# Or use managed Redis (AWS ElastiCache, Redis Cloud, etc.)
export REDIS_URL=redis://your-redis-host:6379
```

#### Implementation

Create `server/middleware/rate-limit.ts`:

```typescript
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { createClient } from "redis";

// Create Redis client with error handling
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => {
  console.error("Redis connection error:", err);
  // Consider implementing reconnection logic or falling back to in-memory rate limiting
});

// Connect to Redis with error handling
redisClient.connect().catch((err) => {
  console.error("Failed to connect to Redis:", err);
  // Application should handle this gracefully, possibly by using in-memory fallback
});

// API rate limiter - 100 requests per 15 minutes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    client: redisClient,
    prefix: "rl:api:",
  }),
  // Skip rate limiting if Redis is unavailable (optional: implement in-memory fallback)
  skip: (req) => !redisClient.isReady,
});

// Webhook rate limiter - 1000 requests per hour (higher for CI webhooks)
export const webhookLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1000,
  message: "Webhook rate limit exceeded.",
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    client: redisClient,
    prefix: "rl:webhook:",
  }),
});

// Analyzer rate limiter - 10 analysis requests per hour (expensive operations)
export const analyzerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Analysis rate limit exceeded. Please wait before starting another analysis.",
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    client: redisClient,
    prefix: "rl:analyzer:",
  }),
});
```

#### Apply Limiters

In `server/routes.ts`:

```typescript
import { apiLimiter, webhookLimiter, analyzerLimiter } from "./middleware/rate-limit";

export async function registerRoutes(httpServer: Server, app: Express) {
  // Apply general API rate limiting
  app.use("/api", apiLimiter);

  // Apply specific limiters to expensive endpoints
  app.post("/api/projects/analyze/:id", analyzerLimiter, async (req, res) => {
    // ... existing code
  });

  app.post("/api/webhooks/github", webhookLimiter, async (req, res) => {
    // ... existing code
  });
}
```

### Option 2: Edge WAF Rate Limiting

Use a Web Application Firewall (WAF) at the edge for rate limiting.

#### Cloudflare

1. Add your domain to Cloudflare
2. Enable **Rate Limiting Rules**:

```
Name: API Rate Limit
If: (http.request.uri.path contains "/api/")
Then: Rate limit
  - Requests: 100 per 10 minutes
  - Action: Block with 429 status
```

#### AWS CloudFront + WAF

Create rate-based rule in AWS WAF:

```bash
aws wafv2 create-rate-based-rule \
  --name api-rate-limit \
  --scope CLOUDFRONT \
  --rate-limit 100 \
  --aggregate-key-type IP
```

#### Google Cloud Armor

```bash
gcloud compute security-policies rules create 1000 \
  --security-policy my-policy \
  --action rate-based-ban \
  --rate-limit-threshold-count 100 \
  --rate-limit-threshold-interval-sec 600
```

### Option 3: Nginx Rate Limiting

If using nginx as reverse proxy (see [DEPLOYMENT.md](DEPLOYMENT.md)), add rate limiting:

```nginx
# Add to nginx.conf
http {
    # Define rate limit zones
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=webhook_limit:10m rate=100r/m;
    limit_req_zone $binary_remote_addr zone=analyzer_limit:10m rate=1r/m;

    server {
        # General API rate limiting
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            limit_req_status 429;
            proxy_pass http://asset_analyzer;
        }

        # Webhook rate limiting
        location /api/webhooks/ {
            limit_req zone=webhook_limit burst=50;
            proxy_pass http://asset_analyzer;
        }

        # Analysis endpoint (expensive operations)
        location ~ ^/api/projects/.*/analyze$ {
            limit_req zone=analyzer_limit burst=2;
            proxy_pass http://asset_analyzer;
        }
    }
}
```

## Rate Limit Configuration Matrix

Recommended limits by endpoint type:

| Endpoint Type | Rate Limit | Window | Burst | Justification |
|--------------|------------|--------|-------|---------------|
| General API | 100 req | 15 min | 20 | Standard API usage |
| Webhooks | 1000 req | 1 hour | 50 | High volume CI events |
| Analysis (expensive) | 10 req | 1 hour | 2 | Resource-intensive operations |
| Health checks | No limit | - | - | Monitoring should not be rate limited |
| Static assets | 1000 req | 5 min | 100 | CDN should cache these |

## Authentication-Based Rate Limiting

For authenticated endpoints (with API_KEY), consider tiered limits:

```typescript
// Example: Different limits based on API key tier
const tierLimits = {
  free: { max: 10, windowMs: 60 * 60 * 1000 }, // 10/hour
  pro: { max: 100, windowMs: 60 * 60 * 1000 }, // 100/hour
  enterprise: { max: 1000, windowMs: 60 * 60 * 1000 }, // 1000/hour
};

// Middleware to detect tier and apply appropriate limit
function getTierForKey(apiKey: string): string {
  // Implement tier detection logic
  return "free";
}
```

## Monitoring Rate Limits

### Logging

Log rate limit hits for analysis:

```typescript
app.use((req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode === 429) {
      console.warn(`Rate limit hit: ${req.method} ${req.path} from ${req.ip}`);
    }
  });
  next();
});
```

### Metrics

Track rate limit metrics (if using Prometheus):

```typescript
import { Counter } from "prom-client";

const rateLimitCounter = new Counter({
  name: "http_rate_limit_hits_total",
  help: "Total number of rate limit hits",
  labelNames: ["endpoint", "method"],
});

// In rate limiter handler
rateLimitCounter.inc({ endpoint: req.path, method: req.method });
```

### Alerts

Set up alerts for:
- Frequent rate limit hits from same IP (possible attack)
- Overall rate limit hit rate > threshold
- Rate limiter errors (e.g., Redis connection failure)

## Testing Rate Limits

### Manual Testing

```bash
# Test API rate limit
for i in {1..150}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5000/api/health
done

# Should see 200s, then 429s after limit exceeded

# Test with different IPs (if testing distributed rate limiting)
curl -H "X-Forwarded-For: 1.2.3.4" http://localhost:5000/api/health
```

### Automated Testing

```bash
# Using Apache Bench
ab -n 200 -c 10 http://localhost:5000/api/health

# Using wrk
wrk -t12 -c400 -d30s http://localhost:5000/api/health
```

## Bypass Mechanisms

### Allowlists

For trusted IPs (monitoring, internal services):

```typescript
const allowlist = ["10.0.0.0/8", "172.16.0.0/12"];

function isAllowlisted(ip: string): boolean {
  return allowlist.some(range => ipInRange(ip, range));
}

// In rate limiter config
skip: (req) => isAllowlisted(req.ip)
```

### Health Check Exemption

Always exclude health checks from rate limiting:

```typescript
app.get("/health", async (req, res) => {
  // No rate limiting on health checks
  res.json({ status: "ok" });
});
```

## Troubleshooting

### Redis Connection Issues

```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping
# Should return: PONG

# Check Redis keys
redis-cli -u $REDIS_URL --scan --pattern 'rl:*'
```

### Rate Limiter Not Working

1. Check Redis is running: `redis-cli ping`
2. Verify REDIS_URL environment variable
3. Check Redis logs: `docker logs redis`
4. Test with curl from different IPs

### False Positives

If legitimate users hit limits:
1. Review rate limit thresholds
2. Check for shared IPs (corporate NAT, VPNs)
3. Consider authentication-based limits instead of IP-based
4. Implement request queueing for burst scenarios

## Migration Path

### Phase 1: In-Memory (Current)
- Suitable for single instance
- No setup required
- Good for development

### Phase 2: Add Redis
- Install Redis
- Add Redis-backed rate limiters
- Keep in-memory as fallback
- Monitor performance

### Phase 3: Edge WAF (Optional)
- Move rate limiting to CDN/WAF
- Reduce application load
- Geographical distribution
- DDoS protection

## Security Considerations

1. **IP Spoofing**: Trust `X-Forwarded-For` only from trusted proxies
2. **Distributed Attacks**: Use CAPTCHA or proof-of-work for high-risk endpoints
3. **Resource Exhaustion**: Set rate limits on expensive operations (analysis)
4. **Monitoring**: Alert on rate limit patterns indicating attacks
5. **Graceful Degradation**: If Redis fails, fall back to in-memory limits

## References

- [Express Rate Limit](https://github.com/express-rate-limit/express-rate-limit)
- [rate-limit-redis](https://github.com/wyattjoh/rate-limit-redis)
- [Nginx Rate Limiting](https://www.nginx.com/blog/rate-limiting-nginx/)
- [Cloudflare Rate Limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [OWASP Rate Limiting](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
