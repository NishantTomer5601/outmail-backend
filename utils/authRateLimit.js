import rateLimit from 'express-rate-limit';
import IORedis from 'ioredis';

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
    lazyConnect: true,
});

// Auth endpoint rate limiters
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes per IP
  message: { 
    error: 'Too many authentication attempts from this IP. Please try again in 15 minutes.',
    retryAfter: 15 * 60 // seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for IP: ${req.ip} on ${req.originalUrl}`);
    res.status(429).json({
      error: 'Too many authentication attempts from this IP. Please try again in 15 minutes.',
      retryAfter: 15 * 60
    });
  }
});

// Google OAuth rate limiter (less strict as it's user-initiated)
export const oauthRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 OAuth attempts per 5 minutes per IP
  message: { 
    error: 'Too many OAuth attempts from this IP. Please try again in 5 minutes.',
    retryAfter: 5 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`OAuth rate limit exceeded for IP: ${req.ip} on ${req.originalUrl}`);
    res.status(429).json({
      error: 'Too many OAuth attempts from this IP. Please try again in 5 minutes.',
      retryAfter: 5 * 60
    });
  }
});

// Strict rate limiter for sensitive endpoints
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 requests per hour per IP
  message: { 
    error: 'Too many requests from this IP. Please try again in 1 hour.',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`Strict rate limit exceeded for IP: ${req.ip} on ${req.originalUrl}`);
    res.status(429).json({
      error: 'Too many requests from this IP. Please try again in 1 hour.',
      retryAfter: 60 * 60
    });
  }
});

// Custom Redis-based rate limiter for more complex scenarios
export const createCustomRateLimiter = (windowMs, maxRequests, keyPrefix = 'rate_limit') => {
  return async (req, res, next) => {
    try {
      const key = `${keyPrefix}:${req.ip}`;
      const current = await redis.incr(key);
      
      if (current === 1) {
        // First request, set expiration
        await redis.expire(key, Math.floor(windowMs / 1000));
      }
      
      if (current > maxRequests) {
        const ttl = await redis.ttl(key);
        console.warn(`Custom rate limit exceeded for IP: ${req.ip} on ${req.originalUrl}. Count: ${current}, TTL: ${ttl}s`);
        
        return res.status(429).json({
          error: `Too many requests. Please try again in ${ttl} seconds.`,
          retryAfter: ttl,
          requestCount: current,
          maxRequests: maxRequests
        });
      }
      
      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Remaining': Math.max(0, maxRequests - current),
        'X-RateLimit-Reset': new Date(Date.now() + windowMs).toISOString()
      });
      
      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      // If Redis fails, allow the request to continue
      next();
    }
  };
};

// Rate limiter for email-related operations
export async function canSendEmail(userId) {
  const dayKey = `user:${userId}:dailyLimit`;
  const dayCount = parseInt(await redis.get(dayKey) || '0', 10);

  if (dayCount >= 50) {
    // Next allowed: next day 9:30am IST
    const now = new Date();
    const nextIST = getISTMidnight();
    nextIST.setDate(nextIST.getDate() + 1);
    nextIST.setHours(9, 30, 0, 0);
    const delayMs = nextIST.getTime() - now.getTime();
    return { allowed: false, delayMs };
  }
  return { allowed: true, delayMs: 0 };
}

export async function incrementEmailCount(userId) {
  const dayKey = `user:${userId}:dailyLimit`;
  const count = await redis.incr(dayKey);
  if (count === 1) await redis.expire(dayKey, 86400); // 24h
}

function getISTMidnight() {
  const now = new Date();
  // IST is UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(utcMidnight + istOffset);
}