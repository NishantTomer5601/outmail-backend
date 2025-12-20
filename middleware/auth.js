import jwt from 'jsonwebtoken';
import prisma from '../prisma/prismaClient.js';

// Helper function to generate new token
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

// Helper function to get cookie options
const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  domain: process.env.NODE_ENV === 'production' ? '.outmail.in' : undefined,
});

export const authenticateJWT = async (req, res, next) => {
  // Read token from cookies instead of Authorization header
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided.' });
  }

  try {
    const userPayload = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token is nearing expiration (less than 1 day left)
    const currentTime = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = userPayload.exp - currentTime;
    const oneDayInSeconds = 24 * 60 * 60;
    
    if (timeUntilExpiry < oneDayInSeconds) {
      console.log(`Token nearing expiration for user ${userPayload.id}. Time left: ${timeUntilExpiry}s`);
      
      try {
        // Fetch fresh user data from database
        const user = await prisma.user.findUnique({
          where: { id: userPayload.id },
          select: {
            id: true,
            email: true,
            display_name: true,
            google_id: true,
            access_token: true,
            refresh_token: true,
            deleted_at: true
          }
        });

        if (!user || user.deleted_at) {
          throw new Error('User not found or deactivated');
        }

        // Generate new token with fresh data
        const newToken = generateToken(user);
        
        // Set new cookie
        res.cookie('token', newToken, getCookieOptions());
        
        // Update req.user with fresh data
        req.user = {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          google_id: user.google_id,
          hasValidTokens: !!(user.access_token && user.refresh_token),
        };
        
        console.log(`Token refreshed automatically for user ${user.id}`);
        
        // Add header to indicate token was refreshed
        res.set('X-Token-Refreshed', 'true');
        
      } catch (refreshError) {
        console.error('Token refresh error:', refreshError.message);
        // If refresh fails, continue with original token if still valid
        req.user = userPayload;
      }
    } else {
      // Token is still valid for more than 1 day
      req.user = userPayload;
    }
    
    next();
  } catch (err) {
    console.error('JWT Verification Error:', err.message);
    
    // Clear invalid cookie
    res.clearCookie('token', getCookieOptions());
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Unauthorized: Token has expired.',
        code: 'TOKEN_EXPIRED',
        message: 'Please login again.'
      });
    }
    return res.status(403).json({ 
      error: 'Forbidden: Invalid token.',
      code: 'INVALID_TOKEN',
      message: 'Please login again.'
    });
  }
};