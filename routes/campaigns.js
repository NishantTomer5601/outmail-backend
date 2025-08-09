import express from 'express';
import multer from 'multer';
import { authenticateJWT } from '../middleware/auth.js';
import { startCampaign, listMyCampaigns } from '../controllers/campaignController.js';

const router = express.Router();

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

router.get('/mine', authenticateJWT, listMyCampaigns);

router.post(
  '/start',
  authenticateJWT,
  upload.single('csv'),
  startCampaign
);

export default router;