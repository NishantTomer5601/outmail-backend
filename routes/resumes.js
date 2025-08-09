import express from 'express';
import multer from 'multer';
import { authenticateJWT } from '../middleware/auth.js';
import { listResumes, uploadResume, deleteResume } from '../controllers/resumeController.js';

const router = express.Router();

const allowedMimeTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
];

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, JPG, and PNG are allowed.'), false);
    }
  },
});

router.use(authenticateJWT);

router.get('/', listResumes);

router.post('/', upload.single('file'), uploadResume);

router.delete('/:id', deleteResume);

export default router;