import { Queue } from 'bullmq';

// Parse the Upstash Redis URL to extract components
const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379');

const connection = {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port) || 6379,
    password: redisUrl.password,
    username: redisUrl.username || 'default',
    tls: redisUrl.protocol === 'rediss:' ? {} : undefined,
};

export const emailQueue = new Queue('emailQueue', { connection });