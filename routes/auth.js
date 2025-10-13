import express from 'express';
import passport from '../config/passport.js';
import {
  myDetails,
  updateName,
  handleGoogleCallback,
  logout,
} from '../controllers/authController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

// Remove setupAppPassword route - no longer needed
router.post('/update-name', authenticateJWT, updateName);
router.get('/me', authenticateJWT, myDetails);
router.post('/logout', logout);

router.get(
  '/google',
  passport.authenticate('google', {
    scope: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/gmail.send',
    ],
    accessType: 'offline',
    prompt: 'consent',
    includeGrantedScopes: true,
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