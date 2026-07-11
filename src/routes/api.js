import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { normalizePhoneNumber } from '../utils/phone.js';
import { startAdminSession, activeSockets, activeQrs } from '../services/whatsapp.js';
import { runGhostingSweeper } from '../cron/jobs.js';
import { processAIQueue } from '../cron/ai-worker.js';
import { authMiddleware, permissionMiddleware } from '../middleware/auth.js';

const router = Router();

// Auth Endpoints
router.post('/auth/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }

    const admin = await prisma.admin.findUnique({
      where: { username },
      include: { role: true }
    });

    if (!admin || !admin.is_active) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    const validPassword = await bcrypt.compare(password, admin.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'tripbwi_secret_key_12984';
    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    res.json({
      success: true,
      data: {
        id: admin.id,
        nama_admin: admin.nama_admin,
        nomor_wa: admin.nomor_wa,
        username: admin.username,
        role: admin.role.name,
        permissions: admin.role.permissions
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

router.get('/auth/me', authMiddleware, (req, res) => {
  const admin = req.admin;
  res.json({
    success: true,
    data: {
      id: admin.id,
      nama_admin: admin.nama_admin,
      nomor_wa: admin.nomor_wa,
      username: admin.username,
      role: admin.role.name,
      permissions: admin.role.permissions
    }
  });
});

// Role Management Endpoints
router.get('/roles', authMiddleware, permissionMiddleware('roles', 'read'), async (req, res, next) => {
  try {
    const roles = await prisma.role.findMany();
    res.json({ success: true, data: roles });
  } catch (err) {
    next(err);
  }
});

router.post('/roles', authMiddleware, permissionMiddleware('roles', 'write'), async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Role name is required.' });
    }

    const upperName = name.trim().toUpperCase();
    const existing = await prisma.role.findUnique({
      where: { name: upperName }
    });

    if (existing) {
      return res.status(400).json({ success: false, error: 'Role already exists.' });
    }

    const defaultPermissions = {
      dashboard: 'none',
      leads: 'none',
      customers: 'none',
      queue: 'none',
      reports: 'none',
      settings: 'none',
      users: 'none',
      roles: 'none'
    };

    const newRole = await prisma.role.create({
      data: {
        name: upperName,
        permissions: defaultPermissions
      }
    });

    res.status(201).json({ success: true, data: newRole });
  } catch (err) {
    next(err);
  }
});

router.put('/roles/:id', authMiddleware, permissionMiddleware('roles', 'write'), async (req, res, next) => {
  try {
    const roleId = parseInt(req.params.id);
    const { permissions } = req.body;
    if (!permissions) {
      return res.status(400).json({ success: false, error: 'Permissions are required.' });
    }

    const updated = await prisma.role.update({
      where: { id: roleId },
      data: { permissions }
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Create Admin
router.post('/admins', authMiddleware, permissionMiddleware('users', 'write'), async (req, res, next) => {
  try {
    const { nama_admin, nomor_wa, username, password, role_id } = req.body;
    if (!nama_admin || !username || !password) {
      return res.status(400).json({ error: 'nama_admin, username, and password are required.' });
    }

    const normalized = nomor_wa ? normalizePhoneNumber(nomor_wa) : null;
    if (normalized) {
      const existingWa = await prisma.admin.findUnique({
        where: { nomor_wa: normalized }
      });
      if (existingWa) {
        return res.status(400).json({ error: 'Admin with this WhatsApp number already exists.' });
      }
    }

    const existingUser = await prisma.admin.findUnique({
      where: { username }
    });
    if (existingUser) {
      return res.status(400).json({ error: 'Admin with this username already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await prisma.admin.create({
      data: {
        nama_admin,
        nomor_wa: normalized,
        username,
        password: hashedPassword,
        role_id: role_id ? parseInt(role_id) : 2 // Default to CS role (ID 2)
      }
    });

    res.status(201).json({ success: true, data: admin });
  } catch (err) {
    next(err);
  }
});

// List Admins
router.get('/admins', authMiddleware, permissionMiddleware('users', 'read'), async (req, res, next) => {
  try {
    const admins = await prisma.admin.findMany({
      include: { role: true }
    });
    const result = admins.map(a => ({
      id: a.id,
      nama_admin: a.nama_admin,
      nomor_wa: a.nomor_wa,
      username: a.username,
      role: a.role.name,
      role_id: a.role_id,
      is_active: a.is_active,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      connected: activeSockets.has(a.id) && !!activeSockets.get(a.id).user
    }));
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Update Admin Details (CRUD)
router.patch('/admins/:id', authMiddleware, permissionMiddleware('users', 'write'), async (req, res, next) => {
  try {
    const adminId = parseInt(req.params.id);
    const { nama_admin, nomor_wa, username, password, role_id, is_active } = req.body;

    const existingAdmin = await prisma.admin.findUnique({
      where: { id: adminId }
    });

    if (!existingAdmin) {
      return res.status(404).json({ error: 'Admin not found.' });
    }

    const updateData = {};
    if (nama_admin !== undefined) updateData.nama_admin = nama_admin;
    if (is_active !== undefined) updateData.is_active = is_active;
    
    if (nomor_wa !== undefined) {
      const normalized = nomor_wa ? normalizePhoneNumber(nomor_wa) : null;
      if (normalized && normalized !== existingAdmin.nomor_wa) {
        const duplicate = await prisma.admin.findUnique({ where: { nomor_wa: normalized } });
        if (duplicate) {
          return res.status(400).json({ error: 'WhatsApp number is already assigned to another account.' });
        }
      }
      updateData.nomor_wa = normalized;
    }

    if (username !== undefined) {
      if (username !== existingAdmin.username) {
        const duplicate = await prisma.admin.findUnique({ where: { username } });
        if (duplicate) {
          return res.status(400).json({ error: 'Username is already taken.' });
        }
      }
      updateData.username = username;
    }

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    if (role_id !== undefined) {
      if (existingAdmin.username === 'admin' && parseInt(role_id) !== existingAdmin.role_id) {
        return res.status(400).json({ error: 'Cannot change default superadmin access role.' });
      }
      updateData.role_id = parseInt(role_id);
    }

    const updated = await prisma.admin.update({
      where: { id: adminId },
      data: updateData
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// Delete Admin Account (CRUD)
router.delete('/admins/:id', authMiddleware, permissionMiddleware('users', 'write'), async (req, res, next) => {
  try {
    const adminId = parseInt(req.params.id);

    if (adminId === req.admin.id) {
      return res.status(400).json({ error: 'Cannot delete your own account while logged in.' });
    }

    const existingAdmin = await prisma.admin.findUnique({
      where: { id: adminId }
    });

    if (!existingAdmin) {
      return res.status(404).json({ error: 'Admin not found.' });
    }

    if (existingAdmin.username === 'admin') {
      return res.status(400).json({ error: 'Cannot delete default superadmin account.' });
    }

    await prisma.admin.delete({
      where: { id: adminId }
    });

    res.json({ success: true, message: 'Admin account deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

// Start/Restart WhatsApp session for Admin
router.get('/admins/:id/session', authMiddleware, permissionMiddleware('settings', 'write'), async (req, res, next) => {
  try {
    const adminId = parseInt(req.params.id);
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    if (!admin.nomor_wa) {
      return res.status(400).json({ error: 'Admin has no WA number assigned.' });
    }

    // Trigger async session start
    startAdminSession(adminId).catch(err => {
      console.error(`Async start session failed for Admin ${adminId}:`, err);
    });

    // Wait a brief moment to let Baileys initialize and generate QR
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const theme = req.query.theme || 'dark';
    const raw = req.query.raw === 'true' ? '&raw=true' : '';
    res.redirect(`/api/admins/${adminId}/qr?theme=${theme}${raw}`);
  } catch (err) {
    next(err);
  }
});

// JSON endpoint for connection status polling
router.get('/admins/:id/status-json', authMiddleware, permissionMiddleware('settings', 'read'), async (req, res, next) => {
  try {
    const adminId = parseInt(req.params.id);
    const hasSocket = activeSockets.has(adminId);
    const socket = activeSockets.get(adminId);
    const connected = hasSocket && socket?.user;
    
    res.json({ 
      success: true, 
      adminId,
      connected: !!connected 
    });
  } catch (err) {
    next(err);
  }
});

// QR Code page
router.get('/admins/:id/qr', authMiddleware, permissionMiddleware('settings', 'read'), async (req, res, next) => {
  try {
    const adminId = parseInt(req.params.id);
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    
    if (!admin) {
      return res.status(404).send('Admin not found');
    }

    const hasSocket = activeSockets.has(adminId);
    const socket = activeSockets.get(adminId);
    const isConnected = hasSocket && socket?.user;
    const isRaw = req.query.raw === 'true';

    const isLightTheme = req.query.theme === 'light';
    const bgColor = isLightTheme ? '#f8fafc' : '#080c14';
    const cardColor = isLightTheme ? '#ffffff' : '#0e1220';
    const textColor = isLightTheme ? '#0f172a' : '#f8fafc';
    const mutedColor = isLightTheme ? '#64748b' : '#94a3b8';
    const borderColor = isLightTheme ? '#e2e8f0' : 'rgba(255, 255, 255, 0.06)';

    if (isConnected) {
      if (isRaw) {
        return res.send(`
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; background: transparent; overflow: hidden; height: 100vh; color: #10b981; font-family: sans-serif; font-weight: bold; }
              </style>
            </head>
            <body>
              Connected
            </body>
          </html>
        `);
      }
      return res.send(`
        <html>
          <head>
            <title>Session Connected</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: 'Inter', sans-serif; text-align: center; padding: 30px 10px; background: ${bgColor}; color: ${textColor}; margin: 0; }
              .card { background: ${cardColor}; padding: 25px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 1px solid #10b981; }
              h1 { color: #10b981; margin-top: 0; font-size: 22px; }
              p { color: ${mutedColor}; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Connected!</h1>
              <p>Admin <strong>${escapeHtml(admin.nama_admin)}</strong> is connected.</p>
              <p>Number: ${socket.user.id.split(':')[0]}</p>
            </div>
          </body>
        </html>
      `);
    }

    const qr = activeQrs.get(adminId);

    if (!qr) {
      if (isRaw) {
        return res.send(`
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; background: transparent; overflow: hidden; height: 100vh; }
                .spinner { width: 32px; height: 32px; border: 3px solid rgba(0,0,0,0.1); border-top-color: #0d9488; border-radius: 50%; animation: spin 1s infinite linear; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              </style>
              <script>
                setTimeout(() => window.location.reload(), 2000);
              </script>
            </head>
            <body>
              <div class="spinner"></div>
            </body>
          </html>
        `);
      }
      return res.send(`
        <html>
          <head>
            <title>QR Code Generating</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: 'Inter', sans-serif; text-align: center; padding: 40px 10px; background: ${bgColor}; color: ${textColor}; margin: 0; }
              .card { background: ${cardColor}; padding: 25px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 1px solid ${borderColor}; }
              p { color: ${mutedColor}; font-size: 14px; }
              .spinner { width: 30px; height: 30px; border: 3px solid ${borderColor}; border-top-color: #6366f1; border-radius: 50%; animation: spin 1s infinite linear; margin: 15px auto; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
            <script>
              setTimeout(() => window.location.reload(), 3000);
            </script>
          </head>
          <body>
            <div class="card">
              <h1 style="font-size: 18px; margin: 0;">Generating QR Code...</h1>
              <div class="spinner"></div>
              <p>Initializing WhatsApp socket instance. Please wait.</p>
            </div>
          </body>
        </html>
      `);
    }

    if (isRaw) {
      return res.send(`
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; background: transparent; overflow: hidden; height: 100vh; }
              #qrcode { background: white; padding: 8px; border-radius: 8px; display: inline-block; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
            </style>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
            <script>
              setInterval(async () => {
                try {
                  const res = await fetch('/api/admins/${adminId}/status-json');
                  const data = await res.json();
                  if (data.connected) {
                    window.location.reload();
                  }
                } catch (e) {}
              }, 3000);
            </script>
          </head>
          <body>
            <div id="qrcode"></div>
            <script>
              new QRCode(document.getElementById("qrcode"), {
                text: "${qr}",
                width: 180,
                height: 180,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.M
              });
            </script>
          </body>
        </html>
      `);
    }

    res.send(`
      <html>
        <head>
          <title>Scan WhatsApp QR Code</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: 'Inter', sans-serif; text-align: center; padding: 20px 10px; background: ${bgColor}; color: ${textColor}; margin: 0; }
            .card { background: ${cardColor}; padding: 20px; border-radius: 16px; display: inline-block; box-shadow: 0 4px 10px rgba(0,0,0,0.1); border: 1px solid ${borderColor}; max-width: 290px; }
            h1 { color: #6366f1; margin-top: 0; font-size: 20px; }
            #qrcode { background: white; padding: 10px; border-radius: 8px; display: inline-block; margin: 15px 0; }
            p { color: ${mutedColor}; line-height: 1.4; font-size: 13px; }
            .btn { background: #475569; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-weight: 500; display: inline-block; margin-top: 10px; font-size: 12px; border: none; cursor: pointer; }
          </style>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
          <script>
            setInterval(async () => {
              try {
                const res = await fetch('/api/admins/${adminId}/status-json');
                const data = await res.json();
                if (data.connected) {
                  window.location.reload();
                }
              } catch (e) {}
            }, 3000);
          </script>
        </head>
        <body>
          <div class="card">
            <h1>WhatsApp Scan</h1>
            <p>Admin: <strong>${escapeHtml(admin.nama_admin)}</strong></p>
            <p>Scan using Linked Devices in WhatsApp:</p>
            <div id="qrcode"></div>
            <br/>
            <a class="btn" href="/api/admins/${adminId}/session?theme=${isLightTheme ? 'light' : 'dark'}">Regenerate QR</a>
          </div>
          <script>
            new QRCode(document.getElementById("qrcode"), {
              text: "${qr}",
              width: 180,
              height: 180,
              colorDark : "#000000",
              colorLight : "#ffffff",
              correctLevel : QRCode.CorrectLevel.M
            });
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    next(err);
  }
});

// Trigger Manual Ghosting Sweeper (Modul B)
router.post('/cron/ghosting-sweeper', authMiddleware, permissionMiddleware('settings', 'write'), async (req, res, next) => {
  try {
    const count = await runGhostingSweeper();
    res.json({ success: true, message: `Swept and closed ${count} inactive leads.` });
  } catch (err) {
    next(err);
  }
});

// Trigger Manual Gemini Extractor (Modul C)
router.post('/cron/gemini-extractor', authMiddleware, permissionMiddleware('queue', 'write'), async (req, res, next) => {
  try {
    console.log('[API] Manually triggering background AI queue processing (force: true)...');
    await processAIQueue(true);
    res.json({ success: true, message: 'AI Extraction triggered and executed successfully!' });
  } catch (err) {
    next(err);
  }
});

// Get Chat History for a Lead
router.get('/leads/:id/messages', authMiddleware, permissionMiddleware('leads', 'read'), async (req, res, next) => {
  try {
    const leadId = parseInt(req.params.id);
    const messages = await prisma.chatMessage.findMany({
      where: { lead_id: leadId },
      orderBy: { waktu_pesan: 'asc' }
    });
    res.json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
});

// Dashboard Data API
router.get('/dashboard', authMiddleware, (req, res, next) => {
  const permissions = req.admin?.role?.permissions || {};
  const hasDashboard = (permissions.dashboard || 'none') !== 'none';
  const hasLeads = (permissions.leads || 'none') !== 'none';

  if (hasDashboard || hasLeads) {
    return next();
  }
  return res.status(403).json({
    success: false,
    error: "Forbidden: Insufficient permissions for dashboard data sync."
  });
}, async (req, res, next) => {
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const admins = await prisma.admin.findMany({ include: { role: true } });
    const leads = await prisma.lead.findMany({
      take: 1000, // Limit sync data payload size to the 1000 most recently active leads
      include: {
        customer: true,
        admin: true,
        messages: {
          where: {
            waktu_pesan: { gte: fourteenDaysAgo } // Only fetch messages from last 14 days to calculate stats
          },
          select: {
            pengirim: true,
            waktu_pesan: true
          },
          orderBy: { waktu_pesan: 'asc' }
        },
        _count: { select: { messages: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });
    
    // Calculate average reply time for each admin (in seconds)
    const adminReplyTimes = {};
    leads.forEach(lead => {
      const adminId = lead.admin_id;
      if (!adminReplyTimes[adminId]) {
        adminReplyTimes[adminId] = [];
      }
      
      const msgs = lead.messages || [];
      let waitingSince = null;
      
      msgs.forEach(msg => {
        if (msg.pengirim === 'customer') {
          if (waitingSince === null) {
            waitingSince = new Date(msg.waktu_pesan);
          }
        } else if (msg.pengirim === 'admin') {
          if (waitingSince !== null) {
            const replyTimeSec = Math.max(0, Math.floor((new Date(msg.waktu_pesan) - waitingSince) / 1000));
            adminReplyTimes[adminId].push(replyTimeSec);
            waitingSince = null;
          }
        }
      });
    });

    const adminAverages = {};
    Object.keys(adminReplyTimes).forEach(adminId => {
      const times = adminReplyTimes[adminId];
      if (times.length > 0) {
        const sum = times.reduce((a, b) => a + b, 0);
        adminAverages[adminId] = Math.round(sum / times.length);
      } else {
        adminAverages[adminId] = null;
      }
    });

    const messagesCount = await prisma.chatMessage.count();
    const unprocessedResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM ChatMessage m
      JOIN \`Lead\` l ON m.lead_id = l.id
      WHERE l.ai_last_analyzed_message_id IS NULL OR m.id > l.ai_last_analyzed_message_id
    `;
    const unprocessedMessagesCount = Number(unprocessedResult[0]?.count || 0);

    res.json({
      success: true,
      data: {
        admins: admins.map(a => ({
          id: a.id,
          nama_admin: a.nama_admin,
          nomor_wa: a.nomor_wa,
          role: a.role?.name || 'CS',
          role_id: a.role_id,
          is_active: a.is_active,
          connected: activeSockets.has(a.id) && !!activeSockets.get(a.id).user,
          avgReplyTime: adminAverages[a.id] !== undefined ? adminAverages[a.id] : null
        })),
        totalLeads: leads.length,
        leads: leads.map(l => ({
          id: l.id,
          kode_lead: l.kode_lead,
          customerHp: l.customer.nomor_hp,
          customerNama: l.customer.nama_kontak,
          adminNama: l.admin.nama_admin,
          status_lead: l.status_lead,
          minat_destinasi: l.minat_destinasi,
          jumlah_peserta: l.jumlah_peserta,
          estimasi_waktu: l.estimasi_waktu,
          catatan_khusus: l.catatan_khusus,
          catatan_sistem: l.catatan_sistem,
          referral_source: l.referral_source,
          estimasi_nilai_order: l.estimasi_nilai_order,
          messagesCount: l._count.messages,
          createdAt: l.createdAt,
          updatedAt: l.updatedAt
        })),
        messages: {
          total: messagesCount,
          unprocessedByAi: unprocessedMessagesCount
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get AI Worker Queue list
router.get('/ai-queue', authMiddleware, permissionMiddleware('queue', 'read'), async (req, res, next) => {
  try {
    const jobs = await prisma.aIJob.findMany({
      orderBy: { updatedAt: 'desc' }
    });
    const leadIds = jobs.map(j => j.lead_id);
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds } },
      include: { customer: true, admin: true }
    });
    const leadMap = new Map(leads.map(l => [l.id, l]));
    
    const result = jobs.map(job => {
      const lead = leadMap.get(job.lead_id);
      return {
        id: job.id,
        lead_id: job.lead_id,
        status: job.status,
        execute_at: job.execute_at,
        retry_count: job.retry_count,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        lead: lead ? {
          kode_lead: lead.kode_lead,
          customerName: lead.customer.nama_kontak || 'Pelanggan WA',
          customerHp: lead.customer.nomor_hp,
          adminName: lead.admin.nama_admin
        } : null
      };
    });
    
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Get Customers with Lead statistics
router.get('/customers', authMiddleware, permissionMiddleware('customers', 'read'), async (req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        leads: {
          orderBy: { updatedAt: 'desc' }
        }
      }
    });
    
    const result = customers.map(c => {
      const totalRevenue = c.leads
        .filter(l => l.status_lead === 'CLOSED WON')
        .reduce((sum, l) => sum + (l.estimasi_nilai_order || 0), 0);
      
      const lastLead = c.leads[0];
      
      return {
        id: c.id,
        nama_kontak: c.nama_kontak || 'Pelanggan WA',
        nomor_hp: c.nomor_hp,
        leadsCount: c.leads.length,
        lastStatus: lastLead ? lastLead.status_lead : 'NONE',
        totalRevenue,
        leads: c.leads
      };
    });
    
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Update Lead manually
router.patch('/leads/:id', authMiddleware, permissionMiddleware('leads', 'write'), async (req, res, next) => {
  try {
    const leadId = parseInt(req.params.id);
    const { status_lead, minat_destinasi, jumlah_peserta, estimasi_waktu, catatan_khusus, estimasi_nilai_order, admin_id, referral_source } = req.body;
    
    const updateData = {};
    if (status_lead !== undefined) updateData.status_lead = status_lead;
    if (minat_destinasi !== undefined) updateData.minat_destinasi = minat_destinasi;
    if (jumlah_peserta !== undefined) updateData.jumlah_peserta = jumlah_peserta ? parseInt(jumlah_peserta) : null;
    if (estimasi_waktu !== undefined) updateData.estimasi_waktu = estimasi_waktu ? new Date(estimasi_waktu) : null;
    if (catatan_khusus !== undefined) updateData.catatan_khusus = catatan_khusus;
    if (estimasi_nilai_order !== undefined) updateData.estimasi_nilai_order = estimasi_nilai_order ? parseInt(estimasi_nilai_order) : null;
    if (admin_id !== undefined) updateData.admin_id = parseInt(admin_id);
    if (referral_source !== undefined) updateData.referral_source = referral_source;
    
    // Handle closed_at when transitioning to CLOSED
    if (status_lead && status_lead.startsWith('CLOSED')) {
      updateData.closed_at = new Date();
    } else if (status_lead) {
      updateData.closed_at = null;
    }
    
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: updateData,
      include: { customer: true, admin: true }
    });
    
    res.json({ success: true, data: updatedLead });
  } catch (err) {
    next(err);
  }
});

// Toggle admin active status
router.post('/admins/:id/toggle', authMiddleware, permissionMiddleware('users', 'write'), async (req, res, next) => {
  try {
    const adminId = parseInt(req.params.id);
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    const updated = await prisma.admin.update({
      where: { id: adminId },
      data: { is_active: !admin.is_active }
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// Dashboard HTML view redirects to React SPA
router.get('/dashboard-html', (req, res) => {
  res.redirect('/');
});

// Error handling middleware
router.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

export default router;
