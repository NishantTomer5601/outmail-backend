import { google } from 'googleapis';
import prisma from '../prisma/prismaClient.js';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export async function getValidAccessToken(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      access_token: true,
      refresh_token: true,
      token_expiry: true,
    },
  });

  if (!user || !user.refresh_token) {
    throw new Error('User not found or no refresh token available');
  }

  // Check if current token is still valid (with 5 minute buffer)
  const now = new Date();
  const expiry = new Date(user.token_expiry);
  const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds

  if (expiry.getTime() - now.getTime() > bufferTime) {
    // Token is still valid
    return user.access_token;
  }

  // Token is expired or about to expire, refresh it
  try {
    oauth2Client.setCredentials({
      refresh_token: user.refresh_token,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    const newTokenExpiry = new Date(credentials.expiry_date);

    // Update user with new token
    await prisma.user.update({
      where: { id: userId },
      data: {
        access_token: credentials.access_token,
        token_expiry: newTokenExpiry,
        // Update refresh token if Google provided a new one
        ...(credentials.refresh_token && { refresh_token: credentials.refresh_token }),
      },
    });

    return credentials.access_token;
  } catch (error) {
    console.error('Token refresh failed:', error);
    throw new Error('Failed to refresh access token');
  }
}