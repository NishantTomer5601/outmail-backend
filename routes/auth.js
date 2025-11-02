import express from 'express';
import passport from '../config/passport.js';
import {
  myDetails,
  updateName,
  setupAppPassword,
  handleGoogleCallback,
  logout,
} from '../controllers/authController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.post('/setup-password', authenticateJWT, setupAppPassword);

router.post('/update-name', authenticateJWT, updateName);

router.get('/me', authenticateJWT, myDetails);

router.post('/logout', logout);

router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: process.env.FRONTEND_URL + '/login?error=google_failed',
    session: false,
  }),
  handleGoogleCallback
);

export default router;