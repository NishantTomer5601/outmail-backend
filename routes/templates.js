import express from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import {
  createTemplate,
  getTemplates,
  updateTemplate,
  deleteTemplate,
} from '../controllers/templateController.js';

const router = express.Router();

router.use(authenticateJWT);

router.post('/', createTemplate);

router.get('/', getTemplates);

router.put('/:id', updateTemplate);

router.delete('/:id', deleteTemplate);

export default router;