import express from 'express';
import passport from '../config/passport.js';
import { handleLogin } from '../controllers/authController.js';
import { updateName } from '../controllers/authController.js';
import { myDetails } from '../controllers/authController.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.post('/login', handleLogin);

router.post('/update-name',updateName);

router.get('/me', myDetails);

// Start Google OAuth
router.get(
  '/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account consent',
  }),
);

// Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login',
    session: false,
  }),
  (req, res) => {
    // 🔍 Step 1: Log the entire user object returned by Passport
    //console.log('✅ OAuth req.user object:', JSON.stringify(req.user, null, 2));

    // 🔍 Step 2: Prepare the token payload
    const payload = {
      id: req.user.id || req.user.google_id,
      email: req.user.email,
      display_name: req.user.display_name,
      google_id: req.user.google_id,
      isFirstTime: !req.user.app_password_hash,
    };

    // 🔍 Step 3: Log the payload to be signed into JWT
    console.log('📦 JWT Payload:', payload);
    console.log('user object:', req.user);

    // 🔐 Step 4: Sign the JWT
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    // 🔍 Step 5: Log the final token (optional)
    //console.log('🔐 JWT Token:', token);

    // 🔁 Step 6: Redirect with token
       console.log('🚀 First-time user, redirecting to dashboard with token...', token , req.user?.google_id);
      res.redirect(`http://localhost:8080/dashboard?token=${token}&google_id=${req.user.google_id}`);
    
  }
);

export default router;