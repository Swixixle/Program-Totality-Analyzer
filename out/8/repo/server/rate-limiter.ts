/**
 * P4 Rate Limiter
 * 
 * Per-IP rate limiting with burst and sustained limits.
 * Returns 429 Too Many Requests with Retry-After header.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
  burstCount: number;
  burstWindowStart: number;
}

interface RateLimiterConfig {
  sustainedLimit: number;
  sustainedWindowMs: number;
  burstLimit: number;
  burstWindowMs: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  sustainedLimit: 100,
  sustainedWindowMs: 60 * 1000,
  burstLimit: 10,
  burstWindowMs: 1000,
};

class RateLimiter {
  private entries: Map<string, RateLimitEntry> = new Map();
  private config: RateLimiterConfig;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    const keys = Array.from(this.entries.keys());
    for (const key of keys) {
      const entry = this.entries.get(key);
      if (entry && now - entry.windowStart > this.config.sustainedWindowMs * 2) {
        this.entries.delete(key);
      }
    }
  }

  check(ip: string): { 
    allowed: boolean; 
    retryAfterMs: number; 
    reason?: string;
    limit: number;
    remaining: number;
    resetMs: number;
  } {
    const now = Date.now();
    let entry = this.entries.get(ip);

    if (!entry) {
      entry = {
        count: 0,
        windowStart: now,
        burstCount: 0,
        burstWindowStart: now,
      };
      this.entries.set(ip, entry);
    }

    if (now - entry.windowStart > this.config.sustainedWindowMs) {
      entry.count = 0;
      entry.windowStart = now;
    }

    if (now - entry.burstWindowStart > this.config.burstWindowMs) {
      entry.burstCount = 0;
      entry.burstWindowStart = now;
    }

    const resetMs = this.config.sustainedWindowMs - (now - entry.windowStart);

    if (entry.burstCount >= this.config.burstLimit) {
      const retryAfterMs = this.config.burstWindowMs - (now - entry.burstWindowStart);
      return {
        allowed: false,
        retryAfterMs: Math.max(retryAfterMs, 100),
        reason: `Burst limit exceeded (${this.config.burstLimit} requests per ${this.config.burstWindowMs}ms)`,
        limit: this.config.sustainedLimit,
        remaining: Math.max(0, this.config.sustainedLimit - entry.count),
        resetMs: Math.max(0, resetMs),
      };
    }

    if (entry.count >= this.config.sustainedLimit) {
      const retryAfterMs = this.config.sustainedWindowMs - (now - entry.windowStart);
      return {
        allowed: false,
        retryAfterMs: Math.max(retryAfterMs, 1000),
        reason: `Rate limit exceeded (${this.config.sustainedLimit} requests per ${this.config.sustainedWindowMs / 1000}s)`,
        limit: this.config.sustainedLimit,
        remaining: 0,
        resetMs: Math.max(0, resetMs),
      };
    }

    entry.count++;
    entry.burstCount++;

    return { 
      allowed: true, 
      retryAfterMs: 0,
      limit: this.config.sustainedLimit,
      remaining: Math.max(0, this.config.sustainedLimit - entry.count),
      resetMs: Math.max(0, resetMs),
    };
  }

  stop(): void {
    clearInterval(this.cleanupInterval);
  }
}

export const publicVerifyLimiter = new RateLimiter({
  sustainedLimit: 100,
  sustainedWindowMs: 60 * 1000,
  burstLimit: 10,
  burstWindowMs: 1000,
});

export const verifyLimiter = new RateLimiter({
  sustainedLimit: 50,
  sustainedWindowMs: 60 * 1000,
  burstLimit: 5,
  burstWindowMs: 1000,
});

export function getClientIp(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return ips.trim();
  }
  return req.ip || "unknown";
}
