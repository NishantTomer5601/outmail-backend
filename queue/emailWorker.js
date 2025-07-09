import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import sendEmailWithGmail from '../utils/sendEmailWithGmail.js';
import { canSendEmail, incrementEmailCount } from '../utils/rateLimit.js';

const prisma = new PrismaClient();
console.log('[Worker] Email Worker is running and ready to process jobs...');

const worker = new Worker(
  'emailQueue',
  async (job) => {
    const {
      campaignId,
      userId,
      recipient,
      templateId,
      resumeIds,
      subject,
      body,
    } = job.data;

    console.log(`[Worker] Processing job ${job.id} for user ${userId}, recipient: ${recipient.email}`);

    // 1. Rate limiting
    const { allowed, delayMs } = await canSendEmail(userId);
    console.log(`[Worker] Rate limit check for user ${userId}: allowed=${allowed}, delayMs=${delayMs}`);
    if (!allowed) {
      console.log(`[Worker] User ${userId} exceeded rate limit. Rescheduling job ${job.id} for ${Math.round(delayMs/60000)} minutes later.`);
      await job.moveToDelayed(Date.now() + delayMs);
      return;
    }

    // 2. Fetch template, resumes, user info
    const template = templateId
      ? await prisma.emailTemplate.findUnique({ where: { id: templateId } })
      : null;
    const resumes = resumeIds && resumeIds.length
      ? await prisma.resume.findMany({ where: { id: { in: resumeIds } } })
      : [];
    const user = await prisma.user.findUnique({ where: { id: userId } });

    console.log(`[Worker] Sending email to ${recipient.email} with subject "${subject || (template && template.subject)}"`);

    // 3. Send email
    const result = await sendEmailWithGmail({
      user,
      recipient,
      subject: subject || (template && template.subject),
      text: body || (template && template.html_content),
      attachments: resumes.map(r => ({
        filename: r.name,
        path: r.s3_path,
      })),
    });

    if (result.success) {
      console.log(`[Worker] Email sent successfully to ${recipient.email}`);
      await incrementEmailCount(userId);
    } else {
      console.error(`[Worker] Failed to send email to ${recipient.email}: ${result.error}`);
    }

    // 5. Log result in EmailLog
    await prisma.emailLog.create({
      data: {
        campaign_id: campaignId,
        recipient_name: recipient.name,
        recipient_email: recipient.email,
        recipient_company: recipient.company,
        sent_at: result.success ? new Date() : null,
        status: result.success ? 'sent' : 'failed',
        error_message: result.success ? null : result.error,
        preview_html: body || (template && template.html_content),
      },
    });

    return result.success;
  },
  { connection: { host: 'localhost', port: 6379 } }
);

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed`);
});
worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job.id} failed:`, err);
});