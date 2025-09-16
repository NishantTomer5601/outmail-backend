import IORedis from 'ioredis';

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
    lazyConnect: true,
});

function getISTMidnight() {
  const now = new Date();
  // IST is UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(utcMidnight + istOffset);
}

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