import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from './config/passport.js';
import { connectDB } from './config/db.js';
import prisma from './prisma/prismaClient.js';
import authRoutes from './routes/auth.js';
import contactRoutes from './routes/contact.js';
import campaignsRouter from './routes/campaigns.js';
import templatesRouter from './routes/templates.js';
import emailUsageRoutes from './routes/emailUsage.js';
import resumesRouter from './routes/resumes.js';

import { createBullBoard } from '@bull-board/api';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';

import { emailQueue } from './queue/emailQueue.js';
import { parsingQueue } from './queue/parsingQueue.js';

import './queue/emailWorker.js'; 
import './queue/parsingWorker.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8080;

connectDB();

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/auth', contactRoutes);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/auth', emailUsageRoutes);
app.use('/api/templates', templatesRouter);
app.use('/api/resumes', resumesRouter);

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(emailQueue),
    new BullMQAdapter(parsingQueue) 
  ],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

app.get('/', (req, res) => {
  res.send('OutMail backend is running ✅');
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});