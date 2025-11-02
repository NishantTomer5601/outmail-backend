import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';
import sendEmailWithGmail from '../utils/sendEmailWithGmail.js';
import { canSendEmail, incrementEmailCount } from '../utils/rateLimit.js';
import { getS3FileBuffer } from '../utils/s3.js';

const prisma = new PrismaClient();
console.log('[Worker] Email Worker is running and ready to process jobs...');

const redisCache = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
    lazyConnect: true,
});

const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
const connection = {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port) || 6379,
    password: redisUrl.password,
    username: redisUrl.username || 'default',
    tls: redisUrl.protocol === 'rediss:' ? {} : undefined,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randomBackoffMs = () => (Math.floor(Math.random() * 4) + 2) * 60 * 1000; // 2–5 minutes

const emailWorker = new Worker('emailQueue', async (job) => {
    const { campaignId, userId, recipient, resumeIds, subject, body } = job.data;
    console.log(`[Email Worker] Processing job ${job.id} for recipient: ${recipient.email}`);

    try {
      const { allowed, delayMs } = await canSendEmail(userId);
      if (!allowed) {
        console.log(`[Email Worker] User ${userId} rate limited. Rescheduling job ${job.id}.`);
        await job.moveToDelayed(Date.now() + delayMs);
        return;
      }

      // 2. Fetch user info
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error(`User ${userId} not found.`);

      // 3. Attachment processing with distributed cache
      const attachments = [];
      if (resumeIds && resumeIds.length > 0) {
        const resumes = await prisma.resume.findMany({ where: { id: { in: resumeIds } } });
        
        for (const resume of resumes) {
          const cacheKey = `attachment:${resume.id}`;
          let fileBuffer;
          
          // A. Try to get the attachment from Redis cache.
          const cachedFile = await redisCache.get(cacheKey);

          if (cachedFile) {
            // B. CACHE HIT: Use the cached version.
            console.log(`[Email Worker] Cache HIT for attachment ${resume.id}`);
            fileBuffer = Buffer.from(cachedFile, 'base64');
          } else {
            // C. CACHE MISS: Fetch from S3.
            console.log(`[Email Worker] Cache MISS for attachment ${resume.id}. Fetching from S3.`);
            const { buffer } = await getS3FileBuffer(resume.s3_path);
            fileBuffer = buffer;

            // D. Store the file in Redis for next time.
            // We store it as a base64 string and set an expiration (e.g., 1 hour).
            await redisCache.set(cacheKey, fileBuffer.toString('base64'), 'EX', 3600);
          }
          
          attachments.push({
            filename: resume.name,
            content: fileBuffer,
          });
        }
      }

      // 4. Send the email
      const result = await sendEmailWithGmail({ user, recipient, subject, text: body, attachments });

      // 5. Log the result
      await prisma.emailLog.create({
        data: {
          campaign_id: campaignId,
          sent_at: result.success ? new Date() : null,
          status: result.success ? 'sent' : 'failed',
          error_message: result.success ? null : result.error,
          preview_html: body,
        },
      });

      // 6. If successful, increment the user's rate limit counter.
      if (result.success) {
        await incrementEmailCount(userId);
        console.log(`[Email Worker] Successfully sent email for job ${job.id}`);
      } else {
        throw new Error(result.error); // Throw error to mark job as failed
      }

      await sleep(randomBackoffMs());

    } catch (error) {
      console.error(`[Email Worker] FAILED to process job ${job.id}:`, error.message);
      await sleep(randomBackoffMs());
      // Let BullMQ handle the failure and potential retries by re-throwing the error.
      throw error;
    }
  },
  { connection }
);

emailWorker.on('failed', (job, err) => {
  console.error(`[Email Worker] Job ${job.id} failed with error:`, err.message);
});