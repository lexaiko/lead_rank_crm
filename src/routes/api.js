import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { normalizePhoneNumber } from '../utils/phone.js';
import { startAdminSession, activeSockets, activeQrs, logoutAdminSession } from '../services/whatsapp.js';
import { runGhostingSweeper } from '../cron/jobs.js';
import { processAIQueue } from '../cron/ai-worker.js';
import { authMiddleware, permissionMiddleware, isOwnScope } from '../middleware/auth.js';
import { getGreetingRules, createGreetingRule, updateGreetingRule, deleteGreetingRule, isDuplicateKeywordError } from '../services/greeting-rules.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

    // Set httpOnly cookie for web browsers
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    // Also return token in body for mobile apps (Bearer token auth)
    res.json({
      success: true,
      token,
      data: {
        id: admin.id,
        nama_admin: admin.nama_admin,
        nomor_wa: admin.nomor_wa,
        username: admin.username,
        role: admin.role.name,
        permissions: admin.role.permissions,
        data_scope: admin.role.data_scope
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
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
      permissions: admin.role.permissions,
      data_scope: admin.role.data_scope
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
        permissions: defaultPermissions,
        data_scope: 'own'
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
    const { permissions, data_scope } = req.body;
    if (!permissions && !data_scope) {
      return res.status(400).json({ success: false, error: 'Permissions or data_scope are required.' });
    }
    if (data_scope !== undefined && !['all', 'own'].includes(data_scope)) {
      return res.status(400).json({ success: false, error: "data_scope must be 'all' or 'own'." });
    }

    const updateData = {};
    if (permissions) updateData.permissions = permissions;
    if (data_scope !== undefined) updateData.data_scope = data_scope;

    const updated = await prisma.role.update({
      where: { id: roleId },
      data: updateData
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
      return res.status(404).json({ success: false, error: 'Admin not found.' });
    }

    const updateData = {};
    if (nama_admin !== undefined) updateData.nama_admin = nama_admin;
    if (is_active !== undefined) updateData.is_active = is_active;
    
    if (nomor_wa !== undefined) {
      const normalized = nomor_wa ? normalizePhoneNumber(nomor_wa) : null;
      if (normalized) {
        const duplicate = await prisma.admin.findFirst({
          where: {
            nomor_wa: normalized,
            NOT: { id: adminId }
          }
        });
        if (duplicate) {
          return res.status(400).json({ success: false, error: 'WhatsApp number is already assigned to another account.' });
        }
      }
      updateData.nomor_wa = normalized;
    }

    if (username !== undefined) {
      if (username) {
        const duplicate = await prisma.admin.findFirst({
          where: {
            username,
            NOT: { id: adminId }
          }
        });
        if (duplicate) {
          return res.status(400).json({ success: false, error: 'Username is already taken.' });
        }
      }
      updateData.username = username;
    }

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    if (role_id !== undefined) {
      if (existingAdmin.username === 'admin' && parseInt(role_id) !== existingAdmin.role_id) {
        return res.status(400).json({ success: false, error: 'Cannot change default superadmin access role.' });
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
router.post('/admins/:id/session/start', authMiddleware, permissionMiddleware('settings', 'write'), async (req, res, next) => {
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

// GET wrapper for the QR iframe on the Settings page: starts the session (if needed) then redirects to the QR page
router.get('/admins/:id/session', authMiddleware, permissionMiddleware('settings', 'write'), async (req, res, next) => {
  try {
    const adminId = parseInt(req.params.id);
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });

    if (!admin) {
      return res.status(404).send('Admin not found');
    }
    if (!admin.nomor_wa) {
      return res.status(400).send('Admin has no WA number assigned.');
    }

    const socket = activeSockets.get(adminId);
    const isConnected = !!(socket && socket.user);

    // Only (re)start the socket when not connected — restarting a live socket would drop the session
    if (!isConnected) {
      startAdminSession(adminId).catch(err => {
        console.error(`Async start session failed for Admin ${adminId}:`, err);
      });
      // Give Baileys a moment to initialize and emit the first QR
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    const theme = req.query.theme || 'dark';
    const raw = req.query.raw === 'true' ? '&raw=true' : '';
    res.redirect(`/api/admins/${adminId}/qr?theme=${theme}${raw}`);
  } catch (err) {
    next(err);
  }
});

// Connection status polling
router.get('/admins/:id/status', authMiddleware, permissionMiddleware('settings', 'read'), async (req, res, next) => {
  try {
    const adminId = parseInt(req.params.id);
    const hasSocket = activeSockets.has(adminId);
    const socket = activeSockets.get(adminId);
    const connected = hasSocket && socket?.user;

    res.json({
      success: true,
      adminId,
      connected: !!connected,
      // Current QR payload so the QR page can detect rotation and re-render (QR codes rotate every ~20-60s)
      qr: connected ? null : (activeQrs.get(adminId) || null)
    });
  } catch (err) {
    next(err);
  }
});

// Logout WhatsApp session for Admin
router.post('/admins/:id/logout', authMiddleware, permissionMiddleware('settings', 'write'), async (req, res, next) => {
  try {
    const adminId = parseInt(req.params.id);
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found.' });
    }

    await logoutAdminSession(adminId);
    
    res.json({ success: true, message: 'WhatsApp session logged out successfully.' });
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
              const renderedQr = ${JSON.stringify(qr)};
              setInterval(async () => {
                try {
                  const res = await fetch('/api/admins/${adminId}/status');
                  const data = await res.json();
                  if (data.connected) {
                    window.location.reload();
                    return;
                  }
                  // Reload when WhatsApp rotates the QR so the displayed code never goes stale
                  if (data.qr && data.qr !== renderedQr) {
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
                text: ${JSON.stringify(qr)},
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
            const renderedQr = ${JSON.stringify(qr)};
            setInterval(async () => {
              try {
                const res = await fetch('/api/admins/${adminId}/status');
                const data = await res.json();
                if (data.connected) {
                  window.location.reload();
                  return;
                }
                // Reload when WhatsApp rotates the QR so the displayed code never goes stale
                if (data.qr && data.qr !== renderedQr) {
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
            <a class="btn" href="#" onclick="fetch('/api/admins/${adminId}/session/start?theme=${isLightTheme ? 'light' : 'dark'}', { method: 'POST' }).then(() => window.location.reload()); return false;">Regenerate QR</a>
          </div>
          <script>
            new QRCode(document.getElementById("qrcode"), {
              text: ${JSON.stringify(qr)},
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
router.post('/jobs/ghosting-sweep', authMiddleware, permissionMiddleware('settings', 'write'), async (req, res, next) => {
  try {
    const count = await runGhostingSweeper();
    res.json({ success: true, message: `Swept and closed ${count} inactive leads.` });
  } catch (err) {
    next(err);
  }
});

// Trigger Manual Gemini Extractor (Modul C)
router.post('/jobs/ai-extract', authMiddleware, permissionMiddleware('queue', 'write'), async (req, res, next) => {
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

    if (isOwnScope(req.admin)) {
      const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { admin_id: true } });
      if (!lead || lead.admin_id !== req.admin.id) {
        return res.status(403).json({ success: false, error: 'Forbidden: You can only view your own leads.' });
      }
    }

    const messages = await prisma.chatMessage.findMany({
      where: { lead_id: leadId },
      orderBy: { waktu_pesan: 'asc' }
    });
    res.json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
});

// Get Deep Analysis for a Lead
router.get('/leads/:id/deep-analysis', authMiddleware, permissionMiddleware('leads', 'read'), async (req, res, next) => {
  try {
    const leadId = parseInt(req.params.id);

    if (isOwnScope(req.admin)) {
      const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { admin_id: true } });
      if (!lead || lead.admin_id !== req.admin.id) {
        return res.status(403).json({ success: false, error: 'Forbidden: You can only view your own leads.' });
      }
    }

    const analyses = await prisma.aIAnalysis.findMany({
      where: { lead_id: leadId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    const latestDeep = analyses.find(a => {
      const json = a.result_json;
      return json && (json.is_deep === true || typeof json.skor_kualitas !== 'undefined');
    });

    res.json({ success: true, data: latestDeep || null });
  } catch (err) {
    next(err);
  }
});

// Trigger Deep Analysis for a Lead
router.post('/leads/:id/deep-analysis', authMiddleware, permissionMiddleware('leads', 'write'), async (req, res, next) => {
  try {
    const leadId = parseInt(req.params.id);

    if (isOwnScope(req.admin)) {
      const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { admin_id: true } });
      if (!lead || lead.admin_id !== req.admin.id) {
        return res.status(403).json({ success: false, error: 'Forbidden: You can only view your own leads.' });
      }
    }

    const messages = await prisma.chatMessage.findMany({
      where: { lead_id: leadId },
      orderBy: { waktu_pesan: 'asc' }
    });

    if (messages.length === 0) {
      return res.status(400).json({ success: false, error: 'Tidak ada riwayat percakapan untuk dianalisis.' });
    }

    // Format the conversation
    const conversationText = messages.map(m => {
      const role = m.pengirim === 'customer' ? 'Customer' : 'Admin/CS';
      
      // Convert waktu_pesan to local WIB time (UTC+7) for accurate evaluation by the LLM
      const d = new Date(m.waktu_pesan);
      const timeStr = m.waktu_pesan 
        ? new Date(d.getTime() + (7 * 60 * 60 * 1000)).toISOString().slice(0, 19).replace('T', ' ') + ' WIB'
        : 'Unknown Date';
      
      // Include reply context (if any) to help the LLM understand quoted responses (e.g. "sesuai rincian di atas")
      let replyContext = '';
      if (m.reply_to_snippet) {
        const quotedWhom = m.reply_to_sender === 'customer' ? 'Customer' : 'Admin/CS';
        replyContext = `[Membalas ${quotedWhom}: "${m.reply_to_snippet.trim()}"] `;
      }
      
      return `[${timeStr}] ${role}: ${replyContext}${m.pesan}`;
    }).join('\n');

    const DEEP_ANALYSIS_SYSTEM_PROMPT = `Kamu adalah sistem analis CRM senior untuk perusahaan Trip Banyuwangi.
Tugasmu adalah menganalisis seluruh percakapan antara Customer dan Admin/CS untuk memberikan wawasan mendalam (Deep Analysis).

Analisis percakapan ini dan berikan output HANYA dalam format JSON objek murni tanpa format markdown (seperti \`\`\`json ... \`\`\`). Objek JSON wajib memiliki key berikut:
1. "skor_kualitas": skor kualitas lead dari 1 sampai 10, disertakan narasi penjelasan (string, contoh: "8/10. Pelanggan menunjukkan ketertarikan tinggi...").
2. "potensi_closing": potensi closing dalam persentase (%) disertai penjelasan narasi mengapa potensi tersebut dinilai demikian (string, contoh: "80%. Pelanggan sangat aktif bertanya dan berencana memesan di akhir bulan...").
3. "budget_sensitivity": estimasi budget sensitivity, harus berupa salah satu dari: "rendah", "sedang", atau "tinggi" diikuti penjelasan narasinya (string, contoh: "Sedang. Pelanggan sempat menanyakan apakah ada potongan harga...").
4. "tipe_buyer": tipe buyer disertai penjelasannya (string, contoh: "Serious Planner. Pelanggan menanyakan detail itinerary dan fasilitas secara beruntun...").
5. "objection_utama": objection/keberatan utama dari customer (string, contoh: "Masalah penyesuaian jadwal cuti kantor...").
6. "kesalahan_saya": kesalahan admin/CS dalam melayani customer (jika ada, tuliskan secara jujur kesalahan/kekurangan admin/CS seperti slow response, kurang informatif, dll. Jika tidak ada, tulis "Tidak ada").
7. "saran_respon": saran atau tips respon yang lebih kuat dan persuasif untuk admin/CS dalam membalas chat agar peluang closing naik.
8. "is_deep": wajib diset bernilai true (boolean).

Harap diingat, kembalikan objek JSON murni secara lengkap tanpa menyertakan block format markdown \`\`\`json ... \`\`\`.`;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const modelsToTry = [
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash-lite-preview',
      'gemini-3.1-flash-lite',
      'gemini-1.5-flash'
    ];

    let lastError = null;
    let responseText = '';

    for (const modelName of modelsToTry) {
      try {
        console.log(`[Deep Analysis] Attempting analysis on Lead ${leadId} using model: ${modelName}`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: DEEP_ANALYSIS_SYSTEM_PROMPT
        });

        const response = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [{ text: `Analisa percakapan ini:\n\n${conversationText}` }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        });

        responseText = response.response.text();
        console.log(`[Deep Analysis] Successfully analyzed Lead ${leadId} using model: ${modelName}`);
        break;
      } catch (err) {
        lastError = err;
        console.warn(`[Deep Analysis Warning] Model ${modelName} failed for Lead ${leadId}: ${err.message}`);
      }
    }

    if (!responseText) {
      throw new Error(`All Gemini models failed in the fallback chain. Last error: ${lastError ? lastError.message : 'Unknown'}`);
    }

    const analysisResult = JSON.parse(responseText.trim());
    
    // Ensure is_deep is set to true
    analysisResult.is_deep = true;

    // Save to database
    const saved = await prisma.aIAnalysis.create({
      data: {
        lead_id: leadId,
        result_json: analysisResult
      }
    });

    res.json({ success: true, data: saved });
  } catch (err) {
    next(err);
  }
});


// Manually insert a chat message for a lead (advanced recovery feature)
router.post('/leads/:id/messages', authMiddleware, permissionMiddleware('leads', 'write'), async (req, res, next) => {
  try {
    const leadId = parseInt(req.params.id);
    const { pengirim, pesan, waktu_pesan } = req.body;

    if (!pengirim || !pesan) {
      return res.status(400).json({ success: false, error: 'Pengirim dan pesan wajib diisi.' });
    }

    if (isOwnScope(req.admin)) {
      const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { admin_id: true } });
      if (!lead || lead.admin_id !== req.admin.id) {
        return res.status(403).json({ success: false, error: 'Forbidden: You can only edit your own leads.' });
      }
    }

    const parsedDate = waktu_pesan ? new Date(waktu_pesan) : new Date();

    const created = await prisma.chatMessage.create({
      data: {
        lead_id: leadId,
        pengirim, // "admin" atau "customer"
        pesan,
        waktu_pesan: parsedDate,
        wa_message_id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      }
    });

    // Update lead last_activity_at if this message is newer
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (lead && (!lead.last_activity_at || lead.last_activity_at < parsedDate)) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { 
          last_activity_at: parsedDate,
          updatedAt: new Date()
        }
      });
    }

    res.json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
});


// List Leads — Server-side pagination, filter, sort, search
router.get('/leads', authMiddleware, permissionMiddleware('leads', 'read'), async (req, res, next) => {
  try {
    const {
      page = '1',
      limit = '20',
      search = '',
      status = '',
      admin_id = '',
      referral = '',
      date_from = '',
      date_to = '',
      sort_by = 'last_activity_at',
      sort_order = 'desc',
      deep_analysis = 'ALL'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Whitelist sort fields to prevent injection
    const validSortFields = ['updatedAt', 'createdAt', 'kode_lead', 'estimasi_nilai_order', 'last_activity_at'];
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'updatedAt';
    const sortDir = sort_order === 'asc' ? 'asc' : 'desc';

    // Build filter
    const where = {
      customer: { is_ignored: false }
    };

    if (status && status !== 'ALL') where.status_lead = status;
    if (referral && referral !== 'ALL') where.referral_source = referral;

    if (isOwnScope(req.admin)) {
      if (admin_id && admin_id !== 'ALL' && parseInt(admin_id) !== req.admin.id) {
        where.admin_id = -1; // impossible ID, return nothing
      } else {
        where.admin_id = req.admin.id;
      }
    } else if (admin_id && admin_id !== 'ALL') {
      where.admin_id = parseInt(admin_id);
    }

    if (date_from || date_to) {
      where.updatedAt = {};
      if (date_from) where.updatedAt.gte = new Date(date_from);
      if (date_to) {
        const end = new Date(date_to);
        end.setHours(23, 59, 59, 999);
        where.updatedAt.lte = end;
      }
    }

    if (search) {
      where.OR = [
        { kode_lead: { contains: search } },
        { minat_destinasi: { contains: search } },
        { customer: { nama_kontak: { contains: search } } },
        { customer: { nomor_hp: { contains: search } } }
      ];
    }

    // Fetch all AIAnalysis records to identify deep analysis leads
    const allAnalyses = await prisma.aIAnalysis.findMany({
      select: { lead_id: true, result_json: true }
    });

    const deepLeadIds = [...new Set(
      allAnalyses
        .filter(a => {
          const json = a.result_json;
          return json && (json.is_deep === true || typeof json.skor_kualitas !== 'undefined');
        })
        .map(a => a.lead_id)
    )];

    if (deep_analysis === 'YES') {
      where.id = { in: deepLeadIds };
    } else if (deep_analysis === 'NO') {
      where.id = { notIn: deepLeadIds };
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          customer: true,
          admin: true,
          _count: { select: { messages: true } }
        },
        // Always push leads with null last_activity_at to the bottom
        orderBy: [
          ...(sortField === 'last_activity_at'
            ? [{ last_activity_at: { sort: sortDir, nulls: 'last' } }]
            : [{ [sortField]: sortDir }, { last_activity_at: { sort: 'desc', nulls: 'last' } }]
          )
        ],
        skip,
        take: limitNum
      }),
      prisma.lead.count({ where })
    ]);

    res.json({
      success: true,
      data: leads.map(l => ({
        id: l.id,
        kode_lead: l.kode_lead,
        customer_id: l.customer_id,
        admin_id: l.admin_id,
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
        ai_summary: l.ai_summary || null,
        last_activity_at: l.last_activity_at,
        has_deep_analysis: deepLeadIds.includes(l.id),
        createdAt: l.createdAt,
        updatedAt: l.updatedAt
      })),
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    next(err);
  }
});

// Dashboard Data API — Slim: pre-aggregated stats + admins + 5 recent leads
router.get('/dashboard', authMiddleware, (req, res, next) => {
  const permissions = req.admin?.role?.permissions || {};
  const hasDashboard = (permissions.dashboard || 'none') !== 'none';
  const hasLeads = (permissions.leads || 'none') !== 'none';
  if (hasDashboard || hasLeads) return next();
  return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions for dashboard data sync.' });
}, async (req, res, next) => {
  try {
    const { admin_id = '', date_from = '', date_to = '' } = req.query;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Report period: defaults to "this month" when no date filter is given
    const periodStart = date_from ? new Date(date_from) : startOfMonth;
    periodStart.setHours(0, 0, 0, 0);
    let periodEnd = null;
    if (date_to) {
      periodEnd = new Date(date_to);
      periodEnd.setHours(23, 59, 59, 999);
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 'own' scoped roles (e.g. CS) are always locked to their own data;
    // other roles may optionally filter the report down to one admin via ?admin_id=
    const effectiveAdminId = isOwnScope(req.admin)
      ? req.admin.id
      : (admin_id && admin_id !== 'ALL' ? parseInt(admin_id) : null);

    const periodFilter = {
      createdAt: { gte: periodStart, ...(periodEnd ? { lte: periodEnd } : {}) },
      customer: { is_ignored: false },
      ...(effectiveAdminId ? { admin_id: effectiveAdminId } : {})
    };
    const allTimeFilter = {
      customer: { is_ignored: false },
      ...(effectiveAdminId ? { admin_id: effectiveAdminId } : {})
    };
    const adminIdSql = effectiveAdminId ? Prisma.sql`AND l.admin_id = ${effectiveAdminId}` : Prisma.empty;

    // Run all aggregation queries in parallel
    const [
      admins,
      statusGroups,
      potentialWonAgg,
      potentialLostAgg,
      referralGroups,
      adminAssigned,
      adminWon,
      adminPotential,
      totalLeads,
      todayCount,
      destinationLeads,
      byDayRaw,
      messagesCount,
      unprocessedResult,
      recentMessages,
      recentLeads
    ] = await Promise.all([
      // Admins with roles — 'own' scope only ever sees themselves in the CS performance table
      prisma.admin.findMany({
        where: isOwnScope(req.admin) ? { id: req.admin.id } : {},
        include: { role: true }
      }),

      // Status counts for the selected period
      prisma.lead.groupBy({
        by: ['status_lead'],
        where: periodFilter,
        _count: { id: true }
      }),

      // Potential won: pipeline value of active leads QUALIFIED..HOT (closed-won revenue is recorded in a separate system)
      prisma.lead.aggregate({
        where: { ...periodFilter, status_lead: { in: ['QUALIFIED', 'PROSPECT', 'HOT'] } },
        _sum: { estimasi_nilai_order: true }
      }),

      // Potential lost: value of CLOSED LOST leads for the selected period
      prisma.lead.aggregate({
        where: { ...periodFilter, status_lead: 'CLOSED LOST' },
        _sum: { estimasi_nilai_order: true }
      }),

      // Referral source counts for the selected period
      prisma.lead.groupBy({
        by: ['referral_source'],
        where: periodFilter,
        _count: { id: true }
      }),

      // Per-admin: total assigned in the selected period
      prisma.lead.groupBy({
        by: ['admin_id'],
        where: periodFilter,
        _count: { id: true }
      }),

      // Per-admin: won count in the selected period
      prisma.lead.groupBy({
        by: ['admin_id'],
        where: { ...periodFilter, status_lead: 'CLOSED WON' },
        _count: { id: true }
      }),

      // Per-admin: potential pipeline value (QUALIFIED..HOT) in the selected period
      prisma.lead.groupBy({
        by: ['admin_id'],
        where: { ...periodFilter, status_lead: { in: ['QUALIFIED', 'PROSPECT', 'HOT'] } },
        _sum: { estimasi_nilai_order: true }
      }),

      // Total active leads (all time, respecting admin scope/filter)
      prisma.lead.count({ where: allTimeFilter }),

      // New leads today (respecting admin scope/filter)
      prisma.lead.count({ where: { ...allTimeFilter, createdAt: { gte: today } } }),

      // Destination strings for the selected period (aggregated in JS since it's comma-separated)
      prisma.lead.findMany({
        where: periodFilter,
        select: { minat_destinasi: true }
      }),

      // Leads by day (last 7 days) — raw SQL for date grouping
      prisma.$queryRaw`
        SELECT DATE(l.createdAt) as date, COUNT(*) as count
        FROM \`Lead\` l
        JOIN \`Customer\` c ON l.customer_id = c.id
        WHERE l.createdAt >= ${sevenDaysAgo} AND c.is_ignored = false ${adminIdSql}
        GROUP BY DATE(l.createdAt)
        ORDER BY date ASC
      `,

      // Total messages count (respecting admin scope/filter)
      prisma.chatMessage.count({
        where: { lead: { customer: { is_ignored: false }, ...(effectiveAdminId ? { admin_id: effectiveAdminId } : {}) } }
      }),

      // Unprocessed by AI
      prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM ChatMessage m
        JOIN \`Lead\` l ON m.lead_id = l.id
        JOIN \`Customer\` c ON l.customer_id = c.id
        WHERE c.is_ignored = false
          AND (l.ai_last_analyzed_message_id IS NULL OR m.id > l.ai_last_analyzed_message_id)
          ${adminIdSql}
      `,

      // Recent messages for avg reply time (14 days, respecting admin scope/filter)
      prisma.chatMessage.findMany({
        where: {
          waktu_pesan: { gte: fourteenDaysAgo },
          lead: { customer: { is_ignored: false }, ...(effectiveAdminId ? { admin_id: effectiveAdminId } : {}) }
        },
        select: { lead_id: true, pengirim: true, waktu_pesan: true },
        orderBy: { waktu_pesan: 'asc' }
      }),

      // 5 most recent leads for activity feed (respecting admin scope/filter)
      prisma.lead.findMany({
        where: allTimeFilter,
        include: { customer: true, admin: true },
        orderBy: [{ last_activity_at: 'desc' }, { updatedAt: 'desc' }],
        take: 5
      })
    ]);

    // --- Compute avg reply time per admin ---
    const msgByLead = new Map();
    recentMessages.forEach(msg => {
      if (!msgByLead.has(msg.lead_id)) msgByLead.set(msg.lead_id, []);
      msgByLead.get(msg.lead_id).push(msg);
    });
    const adminReplyAccum = {};
    msgByLead.forEach((msgs) => {
      // find admin_id from recentLeads is not available here — compute from recentMessages only
      // We'll attach reply times to admin via lead lookup using adminAssigned groupBy data
    });
    // Simpler: compute per lead, group by admin_id from recentLeads association
    // Use a separate small query for the admin lead map
    const leadAdminMap = new Map();
    await prisma.lead.findMany({
      where: { id: { in: [...msgByLead.keys()] } },
      select: { id: true, admin_id: true }
    }).then(rows => rows.forEach(r => leadAdminMap.set(r.id, r.admin_id)));

    const adminReplyTimes = {};
    msgByLead.forEach((msgs, lead_id) => {
      const adminId = leadAdminMap.get(lead_id);
      if (!adminId) return;
      if (!adminReplyTimes[adminId]) adminReplyTimes[adminId] = [];
      let waitingSince = null;
      msgs.forEach(msg => {
        if (msg.pengirim === 'customer') {
          if (waitingSince === null) waitingSince = new Date(msg.waktu_pesan);
        } else if (msg.pengirim === 'admin' && waitingSince !== null) {
          const secs = Math.max(0, Math.floor((new Date(msg.waktu_pesan) - waitingSince) / 1000));
          adminReplyTimes[adminId].push(secs);
          waitingSince = null;
        }
      });
    });
    const adminAvgReply = {};
    Object.entries(adminReplyTimes).forEach(([id, times]) => {
      adminAvgReply[id] = times.length > 0
        ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
        : null;
    });

    // --- Build status map ---
    const byStatus = {};
    statusGroups.forEach(g => { byStatus[g.status_lead] = g._count.id; });

    // --- Build referral map ---
    const byReferral = {};
    referralGroups.forEach(g => {
      const key = g.referral_source || 'tidak diketahui';
      byReferral[key] = (byReferral[key] || 0) + g._count.id;
    });

    // --- Build destination map ---
    const byDestination = {};
    destinationLeads.forEach(({ minat_destinasi }) => {
      if (!minat_destinasi) return;
      minat_destinasi.split(',').forEach(d => {
        const name = d.trim();
        if (name) byDestination[name] = (byDestination[name] || 0) + 1;
      });
    });

    // --- Build by-day map (fill missing days with 0) ---
    const byDayMap = {};
    byDayRaw.forEach(r => {
      let dateKey = r.date;
      if (dateKey instanceof Date) {
        const y = dateKey.getFullYear();
        const m = String(dateKey.getMonth() + 1).padStart(2, '0');
        const d = String(dateKey.getDate()).padStart(2, '0');
        dateKey = `${y}-${m}-${d}`;
      } else if (typeof dateKey === 'string') {
        dateKey = dateKey.split('T')[0].split(' ')[0];
      }
      if (dateKey) {
        byDayMap[dateKey] = Number(r.count);
      }
    });
    const byDay = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${date}`;
      byDay.push({ date: key, count: byDayMap[key] || 0 });
    }

    // --- Build per-admin stats map ---
    const assignedMap = {};
    adminAssigned.forEach(g => { assignedMap[g.admin_id] = g._count.id; });
    const wonMap = {};
    adminWon.forEach(g => { wonMap[g.admin_id] = { count: g._count.id }; });
    const potentialMap = {};
    adminPotential.forEach(g => { potentialMap[g.admin_id] = Number(g._sum.estimasi_nilai_order || 0); });

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
          avgReplyTime: adminAvgReply[a.id] !== undefined ? adminAvgReply[a.id] : null,
          thisMonth: {
            assigned: assignedMap[a.id] || 0,
            won: wonMap[a.id]?.count || 0,
            potentialValue: potentialMap[a.id] || 0
          }
        })),
        stats: {
          totalLeads,
          thisMonth: {
            total: statusGroups.reduce((s, g) => s + g._count.id, 0),
            today: todayCount,
            byStatus,
            potentialWon: Number(potentialWonAgg._sum.estimasi_nilai_order || 0),
            potentialLost: Number(potentialLostAgg._sum.estimasi_nilai_order || 0),
            byReferral,
            byDestination,
            byDay
          }
        },
        recentLeads: recentLeads.map(l => ({
          id: l.id,
          kode_lead: l.kode_lead,
          customerNama: l.customer.nama_kontak,
          adminNama: l.admin.nama_admin,
          status_lead: l.status_lead,
          minat_destinasi: l.minat_destinasi,
          updatedAt: l.updatedAt
        })),
        messages: {
          total: messagesCount,
          unprocessedByAi: Number(unprocessedResult[0]?.count || 0)
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

    const ownScope = isOwnScope(req.admin);
    const visibleJobs = ownScope
      ? jobs.filter(job => leadMap.get(job.lead_id)?.admin_id === req.admin.id)
      : jobs;

    const result = visibleJobs.map(job => {
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



// Delete AI Job from queue
router.delete('/ai-queue/:id', authMiddleware, permissionMiddleware('queue', 'write'), async (req, res, next) => {
  try {
    const jobId = parseInt(req.params.id);

    if (isOwnScope(req.admin)) {
      const job = await prisma.aIJob.findUnique({ where: { id: jobId }, select: { lead_id: true } });
      const lead = job ? await prisma.lead.findUnique({ where: { id: job.lead_id }, select: { admin_id: true } }) : null;
      if (!lead || lead.admin_id !== req.admin.id) {
        return res.status(403).json({ success: false, error: 'Forbidden: You can only manage your own AI queue jobs.' });
      }
    }

    await prisma.aIJob.delete({
      where: { id: jobId }
    });
    res.json({ success: true, message: 'AI Job deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

// Get Customers with Lead statistics
// Supports: GET /customers          → active customers
//           GET /customers?ignored=true → ignored customers
router.get('/customers', authMiddleware, permissionMiddleware('customers', 'read'), async (req, res, next) => {
  try {
    const isIgnored = req.query.ignored === 'true';

    const where = { is_ignored: isIgnored };
    if (isOwnScope(req.admin)) {
      // CS-level roles only see customers whose (single) lead belongs to them
      where.lead = { admin_id: req.admin.id };
    }

    const customers = await prisma.customer.findMany({
      where,
      include: { lead: true },
      orderBy: { createdAt: 'desc' }
    });

    const result = customers.map(c => {
      const lead = c.lead;
      const totalRevenue = lead && lead.status_lead === 'CLOSED WON' ? (lead.estimasi_nilai_order || 0) : 0;

      return {
        id: c.id,
        nama_kontak: c.nama_kontak || 'Pelanggan WA',
        nomor_hp: c.nomor_hp,
        leadsCount: lead ? 1 : 0,
        lastStatus: lead ? lead.status_lead : 'NONE',
        totalRevenue,
        leads: lead ? [lead] : []
      };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Create Customer manually
router.post('/customers', authMiddleware, async (req, res, next) => {
  try {
    const permissions = req.admin?.role?.permissions || {};
    const canWrite = permissions.leads === 'write' || permissions.customers === 'write';
    if (!canWrite) {
      return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions to create customer.' });
    }
    const { nama_kontak, nomor_hp } = req.body;
    if (!nomor_hp) {
      return res.status(400).json({ success: false, error: 'Phone number is required.' });
    }

    const existing = await prisma.customer.findUnique({
      where: { nomor_hp }
    });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Customer with this phone number already exists.' });
    }

    const newCustomer = await prisma.customer.create({
      data: {
        nama_kontak,
        nomor_hp
      }
    });
    res.json({ success: true, data: newCustomer });
  } catch (err) {
    next(err);
  }
});

// Update Customer details
router.patch('/customers/:id', authMiddleware, async (req, res, next) => {
  try {
    const permissions = req.admin?.role?.permissions || {};
    const canWrite = permissions.leads === 'write' || permissions.customers === 'write';
    if (!canWrite) {
      return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions to update customer.' });
    }
    const customerId = parseInt(req.params.id);

    if (isOwnScope(req.admin)) {
      const owned = await prisma.customer.findFirst({
        where: { id: customerId, lead: { admin_id: req.admin.id } },
        select: { id: true }
      });
      if (!owned) {
        return res.status(403).json({ success: false, error: 'Forbidden: You can only edit your own customers.' });
      }
    }

    const { is_ignored, nama_kontak, nomor_hp } = req.body;

    const updateData = {};
    if (is_ignored !== undefined) updateData.is_ignored = is_ignored;
    if (nama_kontak !== undefined) updateData.nama_kontak = nama_kontak;
    if (nomor_hp !== undefined) {
      const existing = await prisma.customer.findFirst({
        where: { nomor_hp, NOT: { id: customerId } }
      });
      if (existing) {
        return res.status(400).json({ success: false, error: 'Another customer with this phone number already exists.' });
      }
      updateData.nomor_hp = nomor_hp;
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: updateData
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// Delete Customer
router.delete('/customers/:id', authMiddleware, async (req, res, next) => {
  try {
    const permissions = req.admin?.role?.permissions || {};
    const canWrite = permissions.leads === 'write' || permissions.customers === 'write';
    if (!canWrite) {
      return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions to delete customer.' });
    }
    const customerId = parseInt(req.params.id);

    if (isOwnScope(req.admin)) {
      const owned = await prisma.customer.findFirst({
        where: { id: customerId, lead: { admin_id: req.admin.id } },
        select: { id: true }
      });
      if (!owned) {
        return res.status(403).json({ success: false, error: 'Forbidden: You can only delete your own customers.' });
      }
    }

    await prisma.customer.delete({
      where: { id: customerId }
    });
    res.json({ success: true, message: 'Customer deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

// Update Lead manually
router.patch('/leads/:id', authMiddleware, permissionMiddleware('leads', 'write'), async (req, res, next) => {
  try {
    const leadId = parseInt(req.params.id);
    const { status_lead, minat_destinasi, jumlah_peserta, estimasi_waktu, catatan_khusus, estimasi_nilai_order, admin_id, referral_source, customer_nama } = req.body;

    const ownScope = isOwnScope(req.admin);
    if (ownScope) {
      const existingLead = await prisma.lead.findUnique({ where: { id: leadId }, select: { admin_id: true } });
      if (!existingLead || existingLead.admin_id !== req.admin.id) {
        return res.status(403).json({ success: false, error: 'Forbidden: You can only edit your own leads.' });
      }
    }

    const updateData = {};
    if (status_lead !== undefined) updateData.status_lead = status_lead;
    if (minat_destinasi !== undefined) updateData.minat_destinasi = minat_destinasi;
    if (jumlah_peserta !== undefined) updateData.jumlah_peserta = jumlah_peserta ? parseInt(jumlah_peserta) : null;
    if (estimasi_waktu !== undefined) updateData.estimasi_waktu = estimasi_waktu ? new Date(estimasi_waktu) : null;
    if (catatan_khusus !== undefined) updateData.catatan_khusus = catatan_khusus;
    if (estimasi_nilai_order !== undefined) updateData.estimasi_nilai_order = estimasi_nilai_order ? parseInt(estimasi_nilai_order) : null;
    if (admin_id !== undefined && !ownScope) updateData.admin_id = parseInt(admin_id);
    if (referral_source !== undefined) updateData.referral_source = referral_source;
    if (customer_nama !== undefined) {
      updateData.customer = {
        update: {
          nama_kontak: customer_nama
        }
      };
    }
    
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

// Activate admin account
router.post('/admins/:id/activate', authMiddleware, permissionMiddleware('users', 'write'), async (req, res, next) => {
  try {
    const adminId = parseInt(req.params.id);
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    const updated = await prisma.admin.update({
      where: { id: adminId },
      data: { is_active: true }
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// Deactivate admin account
router.post('/admins/:id/deactivate', authMiddleware, permissionMiddleware('users', 'write'), async (req, res, next) => {
  try {
    const adminId = parseInt(req.params.id);
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    if (admin.username === 'admin') {
      return res.status(400).json({ error: 'Cannot deactivate default superadmin account.' });
    }
    const updated = await prisma.admin.update({
      where: { id: adminId },
      data: { is_active: false }
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});



// --- Greeting Rules (greeting keyword -> referral source mapping, cached in memory) ---

// List greeting rules (served from cache)
router.get('/greeting-rules', authMiddleware, permissionMiddleware('settings', 'read'), async (req, res, next) => {
  try {
    const rules = await getGreetingRules();
    res.json({ success: true, data: rules });
  } catch (err) {
    next(err);
  }
});

// Create greeting rule
router.post('/greeting-rules', authMiddleware, permissionMiddleware('settings', 'write'), async (req, res, next) => {
  try {
    const keyword = String(req.body.keyword || '').trim().toLowerCase();
    const source = String(req.body.source || '').trim().toLowerCase();
    if (!keyword || !source) {
      return res.status(400).json({ success: false, error: 'Kata sapaan dan sumber lead wajib diisi.' });
    }
    if (!/^[\p{L}\p{N}]+$/u.test(keyword)) {
      return res.status(400).json({ success: false, error: 'Kata sapaan hanya boleh satu kata tanpa spasi/simbol.' });
    }
    const rule = await createGreetingRule(keyword, source);
    res.json({ success: true, data: rule });
  } catch (err) {
    if (isDuplicateKeywordError(err)) {
      return res.status(400).json({ success: false, error: 'Kata sapaan tersebut sudah terdaftar.' });
    }
    next(err);
  }
});

// Update greeting rule
router.patch('/greeting-rules/:id', authMiddleware, permissionMiddleware('settings', 'write'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const updateData = {};
    if (req.body.keyword !== undefined) {
      const keyword = String(req.body.keyword).trim().toLowerCase();
      if (!/^[\p{L}\p{N}]+$/u.test(keyword)) {
        return res.status(400).json({ success: false, error: 'Kata sapaan hanya boleh satu kata tanpa spasi/simbol.' });
      }
      updateData.keyword = keyword;
    }
    if (req.body.source !== undefined) {
      const source = String(req.body.source).trim().toLowerCase();
      if (!source) {
        return res.status(400).json({ success: false, error: 'Sumber lead wajib diisi.' });
      }
      updateData.source = source;
    }
    const rule = await updateGreetingRule(id, updateData);
    res.json({ success: true, data: rule });
  } catch (err) {
    if (isDuplicateKeywordError(err)) {
      return res.status(400).json({ success: false, error: 'Kata sapaan tersebut sudah terdaftar.' });
    }
    next(err);
  }
});

// Delete greeting rule
router.delete('/greeting-rules/:id', authMiddleware, permissionMiddleware('settings', 'write'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await deleteGreetingRule(id);
    res.json({ success: true, message: 'Aturan sapaan berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
});

// Error handling middleware
router.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

export default router;
