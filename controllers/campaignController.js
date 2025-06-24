import fs from 'fs';
import csv from 'csv-parser';
import pool from '../config/db.js';
import { sendEmailWithDelay } from '../services/emailService.js';

export const createCampaign = async (req, res) => {
  const file = req.file;
  const { startTime, endTime, userEmail } = req.body;
  if (!file || !startTime || !userEmail) return res.status(400).json({ error: 'Missing data' });

  const campaignData = [];
  fs.createReadStream(file.path)
    .pipe(csv())
    .on('data', (row) => {
      if (row.name && row.email && row.company) {
        campaignData.push(row);
      }
    })
    .on('end', async () => {
      const campaignName = `${file.originalname}_${Date.now()}`;
      await pool.query(
        'INSERT INTO campaigns (user_email, name, total, file_path, start_time, end_time) VALUES ($1, $2, $3, $4, $5, $6)',
        [userEmail, campaignName, campaignData.length, file.path, startTime, endTime || null]
      );

      await sendEmailWithDelay(userEmail, campaignData);
      return res.status(200).json({ message: 'Campaign started' });
    });
};