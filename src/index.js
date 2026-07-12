import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { prisma } from './config/prisma.js';
import { startAdminSession } from './services/whatsapp.js';
import { initCronJobs } from './cron/jobs.js';
import { startAIWorker } from './cron/ai-worker.js';
import apiRouter from './routes/api.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

import path from 'path';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate limiters for security in production
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 login requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many login attempts from this IP, please try again after 15 minutes.'
  }
});

// Serve static assets from public
app.use(express.static('public'));

// Secure API routes with rate limiters
app.use('/api/auth/login', authLimiter);
app.use('/api', generalLimiter);

// Mounting API routes under /api
app.use('/api', apiRouter);

// Root route serves the React SPA
app.get('/', (req, res) => {
  res.sendFile(path.resolve('public/index.html'));
});

// Wildcard fallback for React routing (non-API routes)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.resolve('public/index.html'));
});

// Global error handling middleware (production-grade)
app.use((err, req, res, next) => {
  console.error('[Global Error]', err);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : err.message || 'Something went wrong.'
  });
});

app.listen(PORT, async () => {
  console.log(`=========================================`);
  console.log(`Trip Banyuwangi CRM Backend is running!`);
  console.log(`Port: ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}`);
  console.log(`=========================================`);

  // Initialize schedules
  initCronJobs();

  // Start the background AI analysis queue worker
  startAIWorker();

  // Auto-connect WhatsApp sessions for active Admins
  try {
    const activeAdmins = await prisma.admin.findMany({
      where: { 
        is_active: true,
        nomor_wa: { not: null }
      }
    });

    if (activeAdmins.length > 0) {
      console.log(`Checking stored WhatsApp sessions for active Admin(s)...`);
      for (const admin of activeAdmins) {
        let hasSession = false;
        try {
          if (prisma.whatsAppSession) {
            const session = await prisma.whatsAppSession.findUnique({
              where: { admin_id_key: { admin_id: admin.id, key: 'creds' } }
            });
            hasSession = !!session;
          } else {
            const rows = await prisma.$queryRawUnsafe(
              'SELECT 1 FROM WhatsAppSession WHERE admin_id = ? AND `key` = "creds" LIMIT 1',
              admin.id
            );
            hasSession = rows.length > 0;
          }
        } catch (e) {
          // Ignore check errors and fallback to not booting
        }

        if (hasSession) {
          console.log(`Auto-booting WhatsApp session for Admin ${admin.nama_admin} (ID ${admin.id})...`);
          startAdminSession(admin.id).catch(err => {
            console.error(`Auto-boot WhatsApp session failed for Admin ${admin.nama_admin} (ID ${admin.id}):`, err);
          });
        } else {
          console.log(`Admin ${admin.nama_admin} (ID ${admin.id}) has no active WhatsApp session. Skipping auto-boot.`);
        }
      }
    } else {
      console.log(`No active Admin accounts found in database.`);
    }
  } catch (err) {
    console.error('Failed to query active Admins on startup:', err.message);
    console.log('Ensure you run "npm run prisma:migrate" and database is accessible.');
  }
});
