import nodemailer from 'nodemailer';
import { decrypt } from '../utils/encryption.js';
import prisma from '../prisma/prismaClient.js';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const sendEmailWithDelay = async (userEmail, recipients) => {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { app_password_hash: true }
  });
  
  const decrypted = decrypt(user.app_password_hash);

  const transporter = nodemailer.createTransporter({
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
