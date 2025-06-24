import express from 'express';
import multer from 'multer';
import { createCampaign } from '../controllers/campaignController.js';

const upload = multer({ dest: 'uploads/' });
const router = express.Router();

router.post('/create', upload.single('csv'), createCampaign);

export default router;