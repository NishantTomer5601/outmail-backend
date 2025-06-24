import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/mine', async (req, res) => {
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
        // Add more fields as needed
      },
    });
    res.json({ campaigns });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

export default router;