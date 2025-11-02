import prisma from '../prisma/prismaClient.js';
import { uploadAttachmentToS3, deleteAttachmentFromS3 } from '../utils/s3.js';
import fs from 'fs/promises';

const MAX_RESUMES_PER_USER = 3;

export const listResumes = async (req, res) => {
  try {
    const resumes = await prisma.resume.findMany({
      where: { user_id: req.user.id },
      orderBy: { uploaded_at: 'desc' },
    });
    res.json(resumes);
  } catch (err) {
    console.error('Failed to list resumes:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

export const uploadResume = async (req, res) => {
  const file = req.file;
  try {
    if (!file) {
      return res.status(400).json({ error: 'No file was uploaded.' });
    }

    const userId = req.user.id;

    // 1. Enforce business logic: check the user's current resume count.
    const count = await prisma.resume.count({ where: { user_id: userId } });
    if (count >= MAX_RESUMES_PER_USER) {
      return res.status(400).json({ error: `Maximum of ${MAX_RESUMES_PER_USER} resumes allowed.` });
    }

    // 2. Upload the file to S3.
    const fileBuffer = await fs.readFile(file.path);
    const s3Url = await uploadAttachmentToS3(fileBuffer, file.originalname, file.mimetype);

    // 3. Create the database record.
    const resume = await prisma.resume.create({
      data: {
        user_id: userId,
        name: file.originalname,
        s3_path: s3Url,
      },
    });

    res.status(201).json(resume);
  } catch (err) {
    console.error('Failed to upload resume:', err);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    // 4. IMPORTANT: Always clean up the temporary file from the local disk.
    if (file && file.path) {
      await fs.unlink(file.path);
    }
  }
};

export const deleteResume = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 1. Find the resume record, ensuring it belongs to the current user.
    const resume = await prisma.resume.findFirst({
      where: { id: id, user_id: userId },
    });

    if (!resume) {
      return res.status(404).json({ error: 'Resume not found or you do not have permission to delete it.' });
    }

    // 2. Delete the file from S3.
    await deleteAttachmentFromS3(resume.s3_path);

    // 3. Delete the record from the database.
    await prisma.resume.delete({ where: { id: id } });

    res.status(204).send();
  } catch (err) {
    console.error('Failed to delete resume:', err);
    // If the S3 delete fails, we should still try to delete the DB record,
    // but we should log the error for investigation.
    res.status(500).json({ error: 'Internal server error.' });
  }
};