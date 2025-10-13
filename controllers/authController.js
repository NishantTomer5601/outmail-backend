import jwt from 'jsonwebtoken';
import prisma from '../prisma/prismaClient.js';

const generateToken = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    google_id: user.google_id,
    // Remove isFirstTime since it's no longer needed
    hasValidTokens: !!(user.access_token && user.refresh_token)
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

export const handleGoogleCallback = async (req, res) => {
  try {
    const user = req.user;
    
    const token = generateToken(user);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?token=${token}`);
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=authentication_failed`);
  }
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
        profile_picture: true,
        created_at: true,
        last_login: true,
        token_expiry: true,
        // Don't expose actual tokens for security
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
    const { access_token, refresh_token, ...userSafe } = updatedUser;
    res.json({ user: userSafe, token: newToken });

  } catch (err) {
    console.error('Update name error:', err);
    res.status(500).json({ error: 'Failed to update name.' });
  }
};

export const logout = (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
};
