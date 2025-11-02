import jwt from 'jsonwebtoken';
import prisma from '../prisma/prismaClient.js';

/* ---------------------- TOKEN GENERATION ---------------------- */
const generateToken = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    google_id: user.google_id,
    hasValidTokens: !!(user.access_token && user.refresh_token),
  };

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
};

/* ---------------------- GOOGLE CALLBACK HANDLER ---------------------- */
export const handleGoogleCallback = async (req, res) => {
  try {
    // req.user is your user object from Passport (not tokens or profile)
    const user = req.user;

    if (!user) {
      console.error("No user found in req.user during Google callback");
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_failed`);
    }

    // Generate JWT for your app
    const token = generateToken(user);

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?token=${token}`);
  } catch (error) {
    console.error("Google callback error:", error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=authentication_failed`);
  }
};

/* ---------------------- MY DETAILS ---------------------- */
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
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    console.error('myDetails error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

/* ---------------------- UPDATE NAME ---------------------- */
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

/* ---------------------- LOGOUT ---------------------- */
export const logout = (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
};