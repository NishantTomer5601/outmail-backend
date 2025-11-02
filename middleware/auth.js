import jwt from 'jsonwebtoken';

export const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    try {
      const userPayload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = userPayload;
      next();
    } catch (err) {
      console.error('JWT Verification Error:', err.message);
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Unauthorized: Token has expired.' });
      }
      return res.status(403).json({ error: 'Forbidden: Invalid token.' });
    }
  } else {
    return res.status(401).json({ error: 'Unauthorized: No token provided or malformed header.' });
  }
};  