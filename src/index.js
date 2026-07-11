import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
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

// Serve static assets from public
app.use(express.static('public'));

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
      console.log(`Booting WhatsApp connections for ${activeAdmins.length} active Admin(s)...`);
      for (const admin of activeAdmins) {
        startAdminSession(admin.id).catch(err => {
          console.error(`Auto-boot WhatsApp session failed for Admin ${admin.nama_admin} (ID ${admin.id}):`, err);
        });
      }
    } else {
      console.log(`No active Admin accounts found in database. Register an Admin to connect to WhatsApp.`);
    }
  } catch (err) {
    console.error('Failed to query active Admins on startup:', err.message);
    console.log('Ensure you run "npm run prisma:migrate" and database is accessible.');
  }
});
