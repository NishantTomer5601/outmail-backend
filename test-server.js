// Simple test server to verify functionality
import express from 'express';
import { authRateLimiter, strictRateLimiter } from './utils/authRateLimit.js';

const app = express();
app.use(express.json());

// Test endpoint with rate limiting
app.get('/test', strictRateLimiter, (req, res) => {
  res.json({ 
    message: 'Rate limiting is working!', 
    timestamp: new Date().toISOString(),
    ip: req.ip
  });
});

// Test auth rate limiter
app.post('/test-auth', authRateLimiter, (req, res) => {
  res.json({ 
    message: 'Auth rate limiting is working!', 
    timestamp: new Date().toISOString(),
    ip: req.ip
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
  console.log('Test endpoints:');
  console.log(`  GET  http://localhost:${PORT}/test`);
  console.log(`  POST http://localhost:${PORT}/test-auth`);
});