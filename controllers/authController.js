import jwt from 'jsonwebtoken';
import prisma from '../prisma/prismaClient.js';
import { encrypt } from '../utils/encryption.js';

const generateToken = (user, res) => {
  const payload = {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    google_id : user.google_id,
    isFirstTime: !user.app_password_hash
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

export const handleGoogleCallback = async (req, res) => {
  try {
    const user = req.user;
    await prisma.user.update({
      where: { email: user.email },
      data: { last_login: new Date() },
    });

    const token = generateToken(user);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?token=${token}`);
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=authentication_failed`);
  }
};

export const logout = (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
};

export const myDetails = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
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
    res.status(500).json({ error: 'Internal server error.' });
  }
};

export const updateName = async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { display_name: name },
    });

    const newToken = generateToken(updatedUser);
    const { app_password_hash, ...userSafe } = updatedUser;
    res.json({ user: userSafe, token: newToken });

  } catch (err) {
    console.error('Update name error:', err);
    res.status(500).json({ error: 'Failed to update name.' });
  }
};

export const setupAppPassword = async (req, res) => {
  const { app_password } = req.body;

  if (!app_password) {
    return res.status(400).json({ error: 'App password is required' });
  }

  try {
    const encryptedPassword = encrypt(app_password);

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        app_password_hash: encryptedPassword,
        isFirstTime: false,
      },
    });

    const newToken = generateToken(user);
    const { app_password_hash, ...userSafe } = user;
    res.status(200).json({ user: userSafe, token: newToken });

  } catch (error) {
    console.error('App password setup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
