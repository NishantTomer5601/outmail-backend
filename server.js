/// File: server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import {connectDB} from './config/db.js';
import authRoutes from './routes/auth.js';
import contactRoutes from './routes/contact.js';
import campaignsRouter from './routes/campaigns.js';
import fileUpload from 'express-fileupload';
import emailUsageRoutes from './routes/emailUsage.js';
import { authenticateJWT } from './middleware/auth.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Connect to PostgreSQL
connectDB();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(fileUpload());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth', contactRoutes);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/auth', emailUsageRoutes);


// Health Check
app.get('/', (req, res) => {
  res.send('OutMail backend is running ✅');
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});