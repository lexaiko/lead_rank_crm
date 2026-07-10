import express from 'express';
import dotenv from 'dotenv';
import { prisma } from './config/prisma.js';
import { startAdminSession } from './services/whatsapp.js';
import { initCronJobs } from './cron/jobs.js';
import apiRouter from './routes/api.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mounting API routes under /api
app.use('/api', apiRouter);

// Root route redirects to dashboard
app.get('/', (req, res) => {
  res.redirect('/api/dashboard-html');
});

app.listen(PORT, async () => {
  console.log(`=========================================`);
  console.log(`Trip Banyuwangi CRM Backend is running!`);
  console.log(`Port: ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/api/dashboard-html`);
  console.log(`=========================================`);

  // Initialize schedules
  initCronJobs();

  // Auto-connect WhatsApp sessions for active Admins
  try {
    const activeAdmins = await prisma.admin.findMany({
      where: { is_active: true }
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
