import prisma from '../prisma/prismaClient.js';
import { uploadCsvToS3 } from '../utils/s3.js';
import { parsingQueue } from '../queue/parsingQueue.js';
import fsPromises from 'fs/promises';

export const startCampaign = async (req, res) => {
  const csvFile = req.file;
  try {
    const userId = req.user.id;
    const { templateId, attachmentIds, subject, body, startTime, timezone, campaignName } = req.body;

    if (!csvFile) {
      return res.status(400).json({ error: 'A CSV or XLSX file with recipient data is required.' });
    }
    if (!campaignName) {
      return res.status(400).json({ error: 'A campaign name is required.' });
    }
    if (!startTime) {
        return res.status(400).json({ error: 'A start time is required.' });
    }

    const fileBuffer = await fsPromises.readFile(csvFile.path);
    const s3Url = await uploadCsvToS3(fileBuffer, csvFile.originalname, csvFile.mimetype);

    const csvUpload = await prisma.csvUpload.create({
      data: {
        s3_path: s3Url,
        original_filename: csvFile.originalname,
        user_id: userId,
      },
    });

    const campaign = await prisma.campaign.create({
      data: {
        user_id: userId,
        csv_upload_id: csvUpload.id,
        template_id: templateId && templateId !== '' && templateId !== 'null' ? templateId : null,
        name: campaignName,
        status: 'parsing', // This new status is key for the frontend UI.
        scheduled_start: new Date(startTime),
        timezone,
        total_emails: 0, // Will be updated by the parsing worker.
        sent_emails: 0,
        failed_emails: 0,
      },
    });

    const resumeIds = Array.isArray(attachmentIds) ? attachmentIds : JSON.parse(attachmentIds || '[]');
    if (resumeIds.length > 0) {
      await prisma.campaignResume.createMany({
        data: resumeIds.map(resumeId => ({
          campaignId: campaign.id,
          resumeId,
        })),
      });
    }

    await parsingQueue.add('parseFile', {
      campaignId: campaign.id,
      userId,
      s3Url,
      originalFilename: csvFile.originalname,
      templateId,
      attachmentIds: resumeIds,
      subject,
      body,
      startTime,
    });

    await fsPromises.unlink(csvFile.path);

    res.status(202).json({
      success: true,
      message: 'Campaign accepted and is being processed.',
      campaignId: campaign.id,
    });
  } catch (err) {
    if (csvFile && csvFile.path) {
      try { await fsPromises.unlink(csvFile.path); } catch {}
    }
    console.error('CAMPAIGN START ERROR:', err);
    res.status(500).json({ error: 'Failed to start campaign.' });
  }
};

export const listMyCampaigns = async (req, res) => {
  const userId = req.user.id;
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        created_at: true,
        started_at: true,
        completed_at: true,
        total_emails: true,
        sent_emails: true,
        failed_emails: true,
      },
    });
    res.json({ campaigns });
  } catch (err) {
    console.error('Failed to fetch campaigns:', err);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
};