import jwt from 'jsonwebtoken';

export const authenticateJWT = (req, res, next) => {
  // Read token from cookies instead of Authorization header
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided.' });
  }

  try {
    const userPayload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = userPayload;
    next();
  } catch (err) {
    console.error('JWT Verification Error:', err.message);
    
    // Clear invalid cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      domain: process.env.NODE_ENV === 'production' ? '.outmail.in' : undefined,
    };
    
    res.clearCookie('token', cookieOptions);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorized: Token has expired.' });
    }
    return res.status(403).json({ error: 'Forbidden: Invalid token.' });
  }
};