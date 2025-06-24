import nodemailer from 'nodemailer';
import { decrypt } from '../utils/encryption.js';
import pool from '../config/db.js';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const sendEmailWithDelay = async (userEmail, recipients) => {
  const userRes = await pool.query('SELECT app_password FROM users WHERE email = $1', [userEmail]);
  const decrypted = decrypt(userRes.rows[0].app_password);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: userEmail,
      pass: decrypted
    }
  });

  for (let i = 0; i < recipients.length; i++) {
    const { name, email, company } = recipients[i];
    const html = `<p>Hello ${name},</p><p>This is an email for ${company} at ${email}.</p>`;
    await transporter.sendMail({
      from: userEmail,
      to: email,
      subject: `Hi ${name}, opportunity at ${company}`,
      html
    });
    await delay(120000); // 2 minutes
  }
};
