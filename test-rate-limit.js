import { authRateLimiter, strictRateLimiter, oauthRateLimiter } from './utils/authRateLimit.js';
import IORedis from 'ioredis';

console.log('Testing Rate Limiters...');

// Test Redis connection
const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
    lazyConnect: true,
});

redis.ping()
  .then(() => {
    console.log('✅ Redis connection successful');
    console.log('✅ Rate limiters imported successfully');
    console.log('✅ authRateLimiter:', typeof authRateLimiter);
    console.log('✅ strictRateLimiter:', typeof strictRateLimiter);
    console.log('✅ oauthRateLimiter:', typeof oauthRateLimiter);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Redis connection failed:', err.message);
    console.log('⚠️  Rate limiters may not work without Redis');
    process.exit(1);
  });