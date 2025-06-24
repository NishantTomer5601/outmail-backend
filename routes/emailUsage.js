import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/email-usage', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const userId = decoded.id;
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Find all campaigns for this user
  const campaigns = await prisma.campaign.findMany({
    where: { user_id: userId },
    select: { id: true },
  });
  const campaignIds = campaigns.map(c => c.id);

  // Count emails sent in the last hour and day
  const [hourlyUsed, dailyUsed] = await Promise.all([
    prisma.emailLog.count({
      where: {
        campaign_id: { in: campaignIds },
        created_at: { gte: oneHourAgo },
      },
    }),
    prisma.emailLog.count({
      where: {
        campaign_id: { in: campaignIds },
        created_at: { gte: oneDayAgo },
      },
    }),
  ]);

  res.json({
    hourlyUsed,
    hourlyLimit: 20,
    dailyUsed,
    dailyLimit: 50,
  });
});

export default router;