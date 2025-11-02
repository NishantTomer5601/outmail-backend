import nodemailer from 'nodemailer';
import { decrypt } from './encryption.js';
import { getS3FileBuffer, getS3KeyFromUrl } from './s3.js';

export default async function sendEmailWithGmail({ user, recipient, subject, text, attachments = [] }) {
  const decrypted = decrypt(user.app_password_hash);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: user.email,
      pass: decrypted,
    },
  });

  // ✅ Convert S3 URLs to actual attachment buffers
const formattedAttachments = attachments.map(({ filename, content }) => ({
    filename,
    content
  }));

  try {
    await transporter.sendMail({
      from: `"${user.display_name}" <${user.email}>`,
      to: recipient.email,
      subject,
      text,
      attachments: formattedAttachments,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}