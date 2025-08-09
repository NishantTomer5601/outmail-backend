import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import csvParser from 'csv-parser';
import xlsx from 'xlsx';
import { getS3Object, getS3FileBuffer } from '../utils/s3.js';
import { emailQueue } from './emailQueue.js';

const prisma = new PrismaClient();

function extractPlaceholders(template) {
  if (!template) return [];
  const regex = /{{\s*([a-zA-Z0-9_ .-]+)\s*}}/g;
  const placeholders = new Set();
  let match;
  while ((match = regex.exec(template))) {
    placeholders.add(match[1].trim().toLowerCase());
  }
  return Array.from(placeholders);
}

function fillPlaceholders(template, data) {
  if (!template) return '';
  return template.replace(/{{\s*([a-zA-Z0-9_ .-]+)\s*}}/g, (_, key) => {
    const value = data[key.trim().toLowerCase()];
    return value !== undefined ? value : '';
  });
}

const connection = { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379') };

const parsingWorker = new Worker('parsingQueue', async (job) => {
    const { campaignId, userId, s3Url, originalFilename, templateId, attachmentIds, subject, body, startTime } = job.data;
    console.log(`[Parsing Worker] Starting to parse file for campaign ${campaignId}`);

    try {
      let templateSubject = subject;
      let templateBody = body;
      if (templateId) {
        const template = await prisma.emailTemplate.findUnique({ where: { id: templateId } });
        if (!template) throw new Error(`Template with ID ${templateId} not found.`);
        templateSubject = subject || template.subject;
        templateBody = body || template.html_content;
      }

      const placeholders = [...new Set([...extractPlaceholders(templateSubject), ...extractPlaceholders(templateBody), 'email'])].map(ph => ph.trim().toLowerCase());

      const s3Object = await getS3Object(s3Url);
      
      const recipients = [];
      const fileExt = originalFilename.split('.').pop().toLowerCase();

      if (fileExt === 'csv') {
        await new Promise((resolve, reject) => {
          s3Object.Body // The body of the S3 object is a readable stream.
            .pipe(csvParser())
            .on('headers', (headers) => {
              const csvHeaders = headers.map(h => h.trim().toLowerCase());
              const missingPlaceholders = placeholders.filter(ph => !csvHeaders.includes(ph));
              if (missingPlaceholders.length > 0) {
                reject(new Error(`Missing placeholders in CSV: ${missingPlaceholders.join(', ')}`));
              }
            })
            .on('data', (row) => {
              const rowData = {};
              Object.keys(row).forEach(k => { rowData[k.trim().toLowerCase()] = row[k]; });
              if (rowData.email) recipients.push(rowData);
            })
            .on('end', resolve)
            .on('error', reject);
        });
      } else if (fileExt === 'xlsx') {
        const fileBuffer = await getS3FileBuffer(s3Object.Body);
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

        if (!rows.length) throw new Error('XLSX file is empty');
        const xlsxHeaders = Object.keys(rows[0]).map(h => h.trim().toLowerCase());
        const missingPlaceholders = placeholders.filter(ph => !xlsxHeaders.includes(ph));
        if (missingPlaceholders.length > 0) {
          throw new Error(`Missing placeholders in XLSX: ${missingPlaceholders.join(', ')}`);
        }
        rows.forEach(row => {
            const rowData = {};
            Object.keys(row).forEach(k => { rowData[k.trim().toLowerCase()] = row[k]; });
            if (rowData.email) recipients.push(rowData);
        });
      } else {
        throw new Error('Unsupported file type. Please use .csv or .xlsx');
      }

      // 4. Create all the individual 'sendEmail' jobs in bulk.
      const emailJobs = recipients.map((recipientData, index) => {
        const delay = new Date(startTime).getTime() + (index * 2 * 60 * 1000) - Date.now();
        return {
          name: 'sendEmail',
          data: {
            campaignId,
            userId,
            recipient: recipientData,
            resumeIds: attachmentIds,
            subject: fillPlaceholders(templateSubject, recipientData),
            body: fillPlaceholders(templateBody, recipientData),
          },
          opts: { delay: delay > 0 ? delay : 0 } // Ensure delay is not negative
        };
      });

      if (emailJobs.length > 0) {
        await emailQueue.addBulk(emailJobs);
      }

      // 5. Finalize the campaign status in the database.
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'scheduled',
          total_emails: recipients.length,
          started_at: new Date(startTime),
        },
      });

      console.log(`[Parsing Worker] Successfully parsed and scheduled ${recipients.length} emails for campaign ${campaignId}`);

    } catch (error) {
      console.error(`[Parsing Worker] FAILED to parse file for campaign ${campaignId}:`, error.message);
      // If parsing fails for any reason, mark the campaign as 'failed' so the user knows.
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'failed' },
      });
    }
  },
  { connection }
);

parsingWorker.on('failed', (job, err) => {
  console.error(`[Parsing Worker] Job ${job.id} failed with error:`, err.message);
});