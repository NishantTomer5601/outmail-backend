import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null // Recommended setting for BullMQ
});

export const parsingQueue = new Queue('parsingQueue', { connection });