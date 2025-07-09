import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { encrypt } from '../utils/encryption.js';
import jwt from 'jsonwebtoken';
const prisma = new PrismaClient();

export const myDetails = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    // You can use decoded.id or decoded.email depending on your JWT payload
    const user = await prisma.user.findUnique({
      where: { email: decoded.email },
      select: {
        id: true,
        google_id: true,
        email: true,
        display_name: true,
        created_at: true,
        last_login: true,
        isFirstTime: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
}


export const updateName = async (req, res) => {
  // 🟦 Log incoming request
  // console.log('🟦 [update-name] Headers:', req.headers);
  // console.log('🟦 [update-name] Body:', req.body);

  // 1. Get and verify JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
    // 🟩 Log decoded JWT
    // console.log('🟩 [update-name] Decoded JWT:', decoded);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // 2. Validate input
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    // 3. Update user in DB (using email from JWT)
    const user = await prisma.user.update({
      where: { email: decoded.email },
      data: { display_name: name },
    });
    // 🟪 Log updated user
    // console.log('🟪 [update-name] User after update:', user);

    // 4. Respond with updated user (without sensitive info)
    const { app_password_hash, ...userSafe } = user;

    // In your updateName controller (after updating the user)
    const payload = {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      google_id: user.google_id,
      isFirstTime: !user.app_password_hash,
    };
    const newToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: userSafe, token: newToken });
  } catch (err) {
    console.error('Update name error:', err);
    res.status(500).json({ error: 'Failed to update name.' });
  }
};

/**
 * Handles user login via Google OAuth.
 * If user exists (by email), updates last_login. If not, creates a new user.
 * Expects req.body: { google_id, email, display_name, app_password_hash }
 */
export const handleLogin = async (req, res) => {
  const { google_id, email, display_name, app_password_hash } = req.body;

  if (!email || !display_name || !app_password_hash) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
   const encryptedPassword = encrypt(app_password_hash);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        last_login: new Date(),
        app_password_hash: encryptedPassword,
        display_name,
        isFirstTime: false, 
      },
      create: {
        id: crypto.randomUUID(),
        google_id,
        email,
        display_name,
        app_password_hash: encryptedPassword,
        last_login: new Date(),
        isFirstTime: false, 
      },
    });

    // Remove sensitive data before sending to frontend
    const { app_password_hash: _, ...userSafe } = user;
    res.status(200).json({ user: userSafe });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
