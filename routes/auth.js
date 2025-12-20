import express from 'express';
import passport from '../config/passport.js';
import {
  myDetails,
  updateName,
  handleGoogleCallback,
  logout,
} from '../controllers/authController.js';
import { authenticateJWT } from '../middleware/auth.js';
import { authRateLimiter, oauthRateLimiter, strictRateLimiter } from '../utils/authRateLimit.js';

const router = express.Router();

// Apply rate limiting to auth endpoints
router.post('/update-name', authRateLimiter, authenticateJWT, updateName);
router.get('/me', strictRateLimiter, authenticateJWT, myDetails);
router.post('/logout', authRateLimiter, logout);

router.get(
  '/google',
  oauthRateLimiter,
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
  oauthRateLimiter,
  passport.authenticate('google', {
    failureRedirect: process.env.FRONTEND_URL + '/login?error=google_failed',
    session: false,
  }),
  handleGoogleCallback
);

export default router;