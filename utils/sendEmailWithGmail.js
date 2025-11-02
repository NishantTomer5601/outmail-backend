import { google } from 'googleapis';
import { getValidAccessToken } from './tokenRefresh.js';
import { getS3FileBuffer, getS3KeyFromUrl } from './s3.js';

export default async function sendEmailWithGmail({ user, recipient, subject, text, attachments = [] }) {
  try {
    // Get a valid access token (refreshes if needed)
    const accessToken = await getValidAccessToken(user.id);

    // Set up OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
    });

    // Set up Gmail API
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Process attachments
    const formattedAttachments = await Promise.all(
      attachments.map(async ({ filename, path }) => {
        const key = getS3KeyFromUrl(path);
        const { buffer } = await getS3FileBuffer(path);
        return {
          filename,
          content: buffer.toString('base64'),
          encoding: 'base64',
        };
      })
    );

    // Create email message
    const email = createEmailMessage({
      from: `"${user.display_name}" <${user.email}>`,
      to: recipient.email,
      subject,
      text,
      attachments: formattedAttachments,
    });

    // Send email using Gmail API
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: email,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Gmail API send error:', error);
    return { success: false, error: error.message };
  }
}

function createEmailMessage({ from, to, subject, text, attachments }) {
  const boundary = 'boundary_' + Math.random().toString(36).substr(2, 9);
  
  let email = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    text,
  ];

  // Add attachments
  attachments.forEach(attachment => {
    email.push(`--${boundary}`);
    email.push(`Content-Type: application/octet-stream; name="${attachment.filename}"`);
    email.push('Content-Transfer-Encoding: base64');
    email.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
    email.push('');
    email.push(attachment.content);
  });

  email.push(`--${boundary}--`);
  
  return Buffer.from(email.join('\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}