import nodemailer from 'nodemailer';
import { decrypt } from './encryption.js';
import { getS3FileBufferFromUrl, getS3KeyFromUrl } from './s3.js';

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
const formattedAttachments = await Promise.all(
  attachments.map(async ({ filename, path }) => {
    const key = getS3KeyFromUrl(path);
    const { buffer } = await getS3FileBufferFromUrl(path);
    return {
      filename,        // preserve the original filename
      content: buffer, // attach file buffer
    };
  })
);

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