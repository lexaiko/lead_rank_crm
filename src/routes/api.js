import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { normalizePhoneNumber } from '../utils/phone.js';
import { startAdminSession, activeSockets, activeQrs } from '../services/whatsapp.js';
import { runGhostingSweeper } from '../cron/jobs.js';
import { processAIQueue } from '../cron/ai-worker.js';

const router = Router();

// Create Admin
router.post('/admins', async (req, res, next) => {
  try {
    const { nama_admin, nomor_wa } = req.body;
    if (!nama_admin || !nomor_wa) {
      return res.status(400).json({ error: 'nama_admin and nomor_wa are required.' });
    }

    const normalized = normalizePhoneNumber(nomor_wa);
    const existing = await prisma.admin.findUnique({
      where: { nomor_wa: normalized }
    });

    if (existing) {
      return res.status(400).json({ error: 'Admin with this phone number already exists.' });
    }

    const admin = await prisma.admin.create({
      data: {
        nama_admin,
        nomor_wa: normalized
      }
    });

    res.status(201).json({ success: true, data: admin });
  } catch (err) {
    next(err);
  }
});

// List Admins
router.get('/admins', async (req, res, next) => {
  try {
    const admins = await prisma.admin.findMany();
    const result = admins.map(a => ({
      ...a,
      connected: activeSockets.has(a.id) && !!activeSockets.get(a.id).user
    }));
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Start/Restart WhatsApp session for Admin
router.get('/admins/:id/session', async (req, res, next) => {
  try {
    const adminId = parseInt(req.params.id);
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Trigger async session start
    startAdminSession(adminId).catch(err => {
      console.error(`Async start session failed for Admin ${adminId}:`, err);
    });

    // Wait a brief moment to let Baileys initialize and generate QR
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const theme = req.query.theme || 'dark';
    res.redirect(`/api/admins/${adminId}/qr?theme=${theme}`);
  } catch (err) {
    next(err);
  }
});

// JSON endpoint for connection status polling
router.get('/admins/:id/status-json', async (req, res, next) => {
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
router.get('/admins/:id/qr', async (req, res, next) => {
  try {
    const adminId = parseInt(req.params.id);
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    
    if (!admin) {
      return res.status(404).send('Admin not found');
    }

    const hasSocket = activeSockets.has(adminId);
    const socket = activeSockets.get(adminId);
    const isConnected = hasSocket && socket?.user;

    const isLightTheme = req.query.theme === 'light';
    const bgColor = isLightTheme ? '#f8fafc' : '#080c14';
    const cardColor = isLightTheme ? '#ffffff' : '#0e1220';
    const textColor = isLightTheme ? '#0f172a' : '#f8fafc';
    const mutedColor = isLightTheme ? '#64748b' : '#94a3b8';
    const borderColor = isLightTheme ? '#e2e8f0' : 'rgba(255, 255, 255, 0.06)';

    if (isConnected) {
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
              <p>Admin <strong>${admin.nama_admin}</strong> is connected.</p>
              <p>Number: ${socket.user.id.split(':')[0]}</p>
            </div>
          </body>
        </html>
      `);
    }

    const qr = activeQrs.get(adminId);

    if (!qr) {
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
            <p>Admin: <strong>${admin.nama_admin}</strong></p>
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
router.post('/cron/ghosting-sweeper', async (req, res, next) => {
  try {
    const count = await runGhostingSweeper();
    res.json({ success: true, message: `Swept and closed ${count} inactive leads.` });
  } catch (err) {
    next(err);
  }
});

// Trigger Manual Gemini Extractor (Modul C)
router.post('/cron/gemini-extractor', async (req, res, next) => {
  try {
    console.log('[API] Manually triggering background AI queue processing (force: true)...');
    await processAIQueue(true);
    res.json({ success: true, message: 'AI Extraction triggered and executed successfully!' });
  } catch (err) {
    next(err);
  }
});

// Get Chat History for a Lead
router.get('/leads/:id/messages', async (req, res, next) => {
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
router.get('/dashboard', async (req, res, next) => {
  try {
    const admins = await prisma.admin.findMany();
    const leads = await prisma.lead.findMany({
      include: {
        customer: true,
        admin: true,
        _count: { select: { messages: true } }
      },
      orderBy: { updatedAt: 'desc' }
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
          is_active: a.is_active,
          connected: activeSockets.has(a.id) && !!activeSockets.get(a.id).user
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

// Dashboard HTML view for user friendly interaction
router.get('/dashboard-html', async (req, res, next) => {
  try {
    const admins = await prisma.admin.findMany();
    const leads = await prisma.lead.findMany({
      include: {
        customer: true,
        admin: true,
        _count: { select: { messages: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const unprocessedResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM ChatMessage m
      JOIN \`Lead\` l ON m.lead_id = l.id
      WHERE l.ai_last_analyzed_message_id IS NULL OR m.id > l.ai_last_analyzed_message_id
    `;
    const unprocessedMessagesCount = Number(unprocessedResult[0]?.count || 0);

    // Calculate Response Times
    const messages = await prisma.chatMessage.findMany({
      orderBy: { waktu_pesan: 'asc' },
      include: {
        lead: {
          select: {
            admin_id: true
          }
        }
      }
    });

    const responseTimesByAdmin = {}; // { [adminId]: [] }
    const allResponseTimes = [];

    // Group messages by lead_id
    const messagesByLead = {};
    for (const msg of messages) {
      if (!messagesByLead[msg.lead_id]) {
        messagesByLead[msg.lead_id] = [];
      }
      messagesByLead[msg.lead_id].push(msg);
    }

    // For each lead, calculate response times
    for (const leadId in messagesByLead) {
      const leadMsgs = messagesByLead[leadId];
      const firstMsg = leadMsgs[0];
      const adminId = firstMsg?.lead?.admin_id;
      if (!adminId) continue;

      if (!responseTimesByAdmin[adminId]) {
        responseTimesByAdmin[adminId] = [];
      }

      let pendingCustomerTime = null;
      for (const m of leadMsgs) {
        if (m.pengirim === 'customer') {
          if (pendingCustomerTime === null) {
            pendingCustomerTime = new Date(m.waktu_pesan).getTime();
          }
        } else if (m.pengirim === 'admin') {
          if (pendingCustomerTime !== null) {
            const replyTime = new Date(m.waktu_pesan).getTime();
            const diffMinutes = (replyTime - pendingCustomerTime) / (1000 * 60);
            
            if (diffMinutes >= 0) {
              responseTimesByAdmin[adminId].push(diffMinutes);
              allResponseTimes.push(diffMinutes);
            }
            pendingCustomerTime = null;
          }
        }
      }
    }

    // Average calculations helper
    function getAverage(times) {
      if (!times || times.length === 0) return null;
      return times.reduce((sum, val) => sum + val, 0) / times.length;
    }

    function formatResponseTime(minutes) {
      if (minutes === null || minutes === undefined || isNaN(minutes)) return '-';
      if (minutes < 1) {
        const seconds = Math.round(minutes * 60);
        return `${seconds}s`;
      }
      if (minutes < 60) {
        return `${minutes.toFixed(1)}m`;
      }
      const hours = minutes / 60;
      if (hours < 24) {
        return `${hours.toFixed(1)}h`;
      }
      const days = hours / 24;
      return `${days.toFixed(1)}d`;
    }

    const avgOverallMinutes = getAverage(allResponseTimes);
    const avgOverallStr = formatResponseTime(avgOverallMinutes);

    // KPI Calculations
    const totalLeads = leads.length;
    const activeLeads = leads.filter(l => ['NEW', 'PROSPEK', 'QUALIFIED', 'HOT'].includes(l.status_lead)).length;
    const totalRevenue = leads.filter(l => l.status_lead === 'CLOSED WON').reduce((sum, l) => sum + (l.estimasi_nilai_order || 0), 0);

    // Dynamic Chart Data Math
    const statusCounts = {
      'PROSPEK': leads.filter(l => l.status_lead === 'PROSPEK').length,
      'QUALIFIED': leads.filter(l => l.status_lead === 'QUALIFIED').length,
      'HOT': leads.filter(l => l.status_lead === 'HOT').length,
      'CLOSED WON': leads.filter(l => l.status_lead === 'CLOSED WON').length,
      'CLOSED LOST': leads.filter(l => l.status_lead === 'CLOSED LOST').length,
      'NEW': leads.filter(l => l.status_lead === 'NEW').length,
    };

    const destCounts = {};
    leads.forEach(l => {
      if (l.minat_destinasi) {
        l.minat_destinasi.split(',').forEach(d => {
          const cleaned = d.trim();
          if (cleaned) {
            destCounts[cleaned] = (destCounts[cleaned] || 0) + 1;
          }
        });
      }
    });

    const refCounts = {
      'instagram': leads.filter(l => l.referral_source === 'instagram').length,
      'tiktok': leads.filter(l => l.referral_source === 'tiktok').length,
      'website': leads.filter(l => l.referral_source === 'website').length,
      'rekomendasi': leads.filter(l => l.referral_source === 'rekomendasi').length,
      'facebook': leads.filter(l => l.referral_source === 'facebook').length,
      'lainnya': leads.filter(l => l.referral_source === 'lainnya').length,
      'tidak diketahui': leads.filter(l => !l.referral_source || l.referral_source === 'tidak diketahui').length,
    };

    const adminRows = admins.map(a => {
      const isConnected = activeSockets.has(a.id) && !!activeSockets.get(a.id).user;
      const statusBadge = isConnected 
        ? '<span class="status-indicator online"><span class="pulse-dot"></span>Connected</span>' 
        : '<span class="status-indicator offline">Disconnected</span>';
      
      const adminAvgMinutes = getAverage(responseTimesByAdmin[a.id]);
      const adminAvgStr = formatResponseTime(adminAvgMinutes);

      return `
        <tr>
          <td><span class="id-badge">ID ${a.id}</span></td>
          <td><strong class="admin-name-td">${a.nama_admin}</strong></td>
          <td style="font-family: monospace; font-size: 13px; color: var(--text-muted);">${a.nomor_wa}</td>
          <td>${statusBadge}</td>
          <td style="font-weight: 600; color: var(--primary);">${adminAvgStr}</td>
          <td>
            <button onclick="openQrModal(${a.id}, '${a.nama_admin}')" class="action-btn-connect" style="border: none; cursor: pointer;">Connect / QR</button>
          </td>
        </tr>
      `;
    }).join('');

    const leadRows = leads.map(l => {
      let badgeClass = 'badge-new';
      if (l.status_lead === 'HOT') badgeClass = 'badge-hot';
      else if (l.status_lead === 'CLOSED WON') badgeClass = 'badge-won';
      else if (l.status_lead === 'CLOSED LOST') badgeClass = 'badge-lost';
      else if (l.status_lead === 'PROSPEK') badgeClass = 'badge-prospek';
      else if (l.status_lead === 'QUALIFIED') badgeClass = 'badge-qualified';

      const estimasiWaktuStr = l.estimasi_waktu ? new Date(l.estimasi_waktu).toISOString().split('T')[0] : '-';
      const nilaiOrderStr = l.estimasi_nilai_order
        ? 'Rp ' + l.estimasi_nilai_order.toLocaleString('id-ID')
        : '-';
      const referralBadge = l.referral_source && l.referral_source !== 'tidak diketahui'
        ? `<span class="ref-tag">${l.referral_source}</span>`
        : '<span style="color: var(--text-muted); font-size: 11px;">tidak diketahui</span>';

      return `
        <tr onclick="openChatDrawer(${l.id}, '${l.kode_lead}', '${l.customer.nomor_hp}', '${l.customer.nama_kontak || ''}')" style="cursor: pointer;" class="lead-row" data-status="${l.status_lead}" data-referral="${l.referral_source || 'tidak diketahui'}" data-admin="${l.admin.nama_admin}">
          <td><span style="font-family: monospace; color: var(--primary); font-weight: bold;">${l.kode_lead}</span></td>
          <td>
            <div style="font-weight: 600; color: var(--text-main);">${l.customer.nama_kontak || 'Pelanggan WA'}</div>
            <div style="font-size: 12px; color: var(--text-muted); font-family: monospace;">${l.customer.nomor_hp}</div>
          </td>
          <td><span style="font-size: 13px; color: var(--text-main);">${l.admin.nama_admin}</span></td>
          <td><span class="badge ${badgeClass}">${l.status_lead}</span></td>
          <td><span style="font-size: 13px; color: var(--text-main);">${l.minat_destinasi || '-'}</span></td>
          <td style="text-align: center;"><span class="count-pill">${l.jumlah_peserta || '-'}</span></td>
          <td><span style="font-size: 13px; color: var(--text-main);">${estimasiWaktuStr}</span></td>
          <td>${referralBadge}</td>
          <td><span style="font-weight: 600; color: var(--accent); font-size: 14px;">${nilaiOrderStr}</span></td>
          <td style="max-width: 250px; font-size: 12px; color: var(--text-muted);">
            ${l.catatan_khusus ? `<div style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${l.catatan_khusus}</div>` : ''}
            ${l.catatan_sistem ? `<div style="font-size: 11px; color: #f43f5e; margin-top: 4px; font-weight: 500;">⚠️ ${l.catatan_sistem}</div>` : ''}
          </td>
          <td style="text-align: center;"><span class="chat-count-badge">${l._count.messages}</span></td>
        </tr>
      `;
    }).join('');

    const mobileCards = leads.map(l => {
      let badgeClass = 'badge-new';
      if (l.status_lead === 'HOT') badgeClass = 'badge-hot';
      else if (l.status_lead === 'CLOSED WON') badgeClass = 'badge-won';
      else if (l.status_lead === 'CLOSED LOST') badgeClass = 'badge-lost';
      else if (l.status_lead === 'PROSPEK') badgeClass = 'badge-prospek';
      else if (l.status_lead === 'QUALIFIED') badgeClass = 'badge-qualified';

      const nilaiOrderStr = l.estimasi_nilai_order
        ? 'Rp ' + l.estimasi_nilai_order.toLocaleString('id-ID')
        : '-';

      return `
        <div onclick="openChatDrawer(${l.id}, '${l.kode_lead}', '${l.customer.nomor_hp}', '${l.customer.nama_kontak || ''}')" class="mobile-lead-card" data-status="${l.status_lead}" data-referral="${l.referral_source || 'tidak diketahui'}" data-admin="${l.admin.nama_admin}">
          <div class="mobile-card-header">
            <span class="mobile-card-code">${l.kode_lead}</span>
            <span class="badge ${badgeClass}">${l.status_lead}</span>
          </div>
          <div class="mobile-card-body">
            <div class="mobile-card-field">
              <strong>Pelanggan:</strong>
              <span>${l.customer.nama_kontak || 'Pelanggan WA'} (${l.customer.nomor_hp})</span>
            </div>
            <div class="mobile-card-field">
              <strong>Destinasi:</strong>
              <span>${l.minat_destinasi || '-'}</span>
            </div>
            <div class="mobile-card-field">
              <strong>Estimasi Nilai:</strong>
              <span style="color: var(--accent); font-weight: 700;">${nilaiOrderStr}</span>
            </div>
            <div class="mobile-card-field">
              <strong>PIC CS:</strong>
              <span>${l.admin.nama_admin}</span>
            </div>
          </div>
          <div class="mobile-card-footer">
            <span>Chats: <strong style="color: var(--primary);">${l._count.messages}</strong></span>
            <span style="color: var(--text-muted); font-size: 11px;">Tap to view chat history</span>
          </div>
        </div>
      `;
    }).join('');

    res.send(`
      <html>
        <head>
          <title>Trip Banyuwangi CRM Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet">
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
          <style>
            :root {
              --bg-color: #060913;
              --sidebar-bg: #0b0f19;
              --card-bg: rgba(17, 24, 39, 0.6);
              --border-color: rgba(255, 255, 255, 0.06);
              --primary: #6366f1;
              --primary-glow: rgba(99, 102, 241, 0.15);
              --secondary: #0ea5e9;
              --accent: #10b981;
              --text-main: #f8fafc;
              --text-muted: #94a3b8;
              --table-header: rgba(255, 255, 255, 0.02);
              --row-hover: rgba(255, 255, 255, 0.015);
              --input-bg: #0b0f19;
              --chat-bubble-customer: #1e293b;
              --chat-text-customer: #f8fafc;
              --sidebar-text: #f8fafc;
              --active-nav: rgba(99, 102, 241, 0.12);
              --admin-td-color: #f1f5f9;
            }

            body.light-mode {
              --bg-color: #f8fafc;
              --sidebar-bg: #ffffff;
              --card-bg: #ffffff;
              --border-color: #e2e8f0;
              --primary: #4f46e5;
              --primary-glow: rgba(79, 70, 229, 0.08);
              --secondary: #0284c7;
              --accent: #10b981;
              --text-main: #0f172a;
              --text-muted: #64748b;
              --table-header: #f8fafc;
              --row-hover: rgba(79, 70, 229, 0.03);
              --input-bg: #ffffff;
              --chat-bubble-customer: #f1f5f9;
              --chat-text-customer: #0f172a;
              --sidebar-text: #0f172a;
              --active-nav: rgba(79, 70, 229, 0.08);
              --admin-td-color: #1e293b;
            }

            * { box-sizing: border-box; }
            body { 
              font-family: 'Inter', sans-serif; 
              margin: 0; 
              background: var(--bg-color); 
              color: var(--text-main); 
              padding: 0;
              min-height: 100vh;
              display: flex;
              transition: background-color 0.3s, color 0.3s;
            }

            h1, h2, h3, h4 { font-family: 'Outfit', sans-serif; font-weight: 700; margin: 0; }

            /* App Sidebar Container */
            .sidebar {
              width: 280px;
              background: var(--sidebar-bg);
              border-right: 1px solid var(--border-color);
              position: fixed;
              top: 0; bottom: 0; left: 0;
              display: flex;
              flex-direction: column;
              z-index: 110;
              transition: transform 0.3s ease, background-color 0.3s, border-color 0.3s;
            }
            .sidebar-header {
              padding: 24px;
              border-bottom: 1px solid var(--border-color);
              display: flex;
              align-items: center;
              justify-content: space-between;
            }
            .sidebar-logo {
              width: 36px;
              height: 36px;
              background: linear-gradient(135deg, var(--primary), var(--secondary));
              border-radius: 10px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 800;
              font-size: 20px;
              color: white;
            }
            .sidebar-logo-text { font-size: 20px; color: var(--sidebar-text); font-weight: bold; }
            
            .sidebar-menu {
              flex: 1;
              padding: 24px 16px;
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            .menu-item {
              display: flex;
              align-items: center;
              gap: 12px;
              padding: 12px 16px;
              border-radius: 8px;
              color: var(--text-muted);
              text-decoration: none;
              font-size: 14px;
              font-weight: 600;
              transition: all 0.2s;
            }
            .menu-item:hover, .menu-item.active {
              background: var(--active-nav);
              color: var(--primary);
            }

            .sidebar-actions {
              padding: 20px 16px;
              border-top: 1px solid var(--border-color);
              display: flex;
              flex-direction: column;
              gap: 12px;
            }

            .sidebar-close-btn {
              background: none;
              border: none;
              color: var(--text-muted);
              cursor: pointer;
              padding: 6px;
              display: none;
              align-items: center;
              justify-content: center;
              border-radius: 6px;
            }
            .sidebar-close-btn:hover {
              color: var(--text-main);
              background: var(--active-nav);
            }

            /* Theme Toggle Button */
            .theme-toggle-container {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 10px 16px;
              background: rgba(0,0,0,0.03);
              border-radius: 8px;
              font-size: 13px;
              color: var(--text-muted);
              font-weight: 600;
              border: 1px solid var(--border-color);
            }
            .theme-switch {
              position: relative;
              display: inline-block;
              width: 40px;
              height: 20px;
            }
            .theme-switch input { opacity: 0; width: 0; height: 0; }
            .slider {
              position: absolute;
              cursor: pointer;
              top: 0; left: 0; right: 0; bottom: 0;
              background-color: #cbd5e1;
              transition: .4s;
              border-radius: 34px;
            }
            .slider:before {
              position: absolute;
              content: "";
              height: 14px;
              width: 14px;
              left: 3px;
              bottom: 3px;
              background-color: white;
              transition: .4s;
              border-radius: 50%;
            }
            input:checked + .slider { background-color: var(--primary); }
            input:checked + .slider:before { transform: translateX(20px); }

            /* Main Layout Body Area */
            .main-panel {
              margin-left: 280px;
              flex: 1;
              min-width: 0;
              display: flex;
              flex-direction: column;
            }

            .top-header {
              background: var(--card-bg);
              backdrop-filter: blur(10px);
              border-bottom: 1px solid var(--border-color);
              padding: 20px 40px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              position: sticky;
              top: 0;
              z-index: 100;
            }

            .menu-toggle-btn {
              background: none;
              border: none;
              color: var(--text-main);
              cursor: pointer;
              padding: 6px;
              display: none;
              align-items: center;
              justify-content: center;
              border-radius: 6px;
            }
            .menu-toggle-btn:hover {
              background: var(--active-nav);
            }

            .main-content {
              padding: 40px;
              max-width: 1400px;
              width: 100%;
              margin: 0 auto;
            }

            /* Analytics charts grid */
            .analytics-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
              gap: 30px;
              margin-bottom: 30px;
            }
            .chart-card {
              background: var(--card-bg);
              border: 1px solid var(--border-color);
              border-radius: 16px;
              padding: 24px;
              min-height: 320px;
              display: flex;
              flex-direction: column;
              box-shadow: 0 4px 6px rgba(0,0,0,0.02);
            }
            .chart-title { font-size: 13px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-bottom: 15px; }
            .chart-container { position: relative; flex: 1; display: flex; align-items: center; justify-content: center; }

            /* KPI metric cards */
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
              gap: 20px;
              margin-bottom: 30px;
            }
            .stat-card {
              background: var(--card-bg);
              border: 1px solid var(--border-color);
              border-radius: 16px;
              padding: 24px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              box-shadow: 0 4px 10px rgba(0,0,0,0.01);
            }
            .stat-info { display: flex; flex-direction: column; gap: 4px; }
            .stat-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
            .stat-val { font-size: 24px; font-weight: 800; font-family: 'Outfit', sans-serif; color: var(--text-main); }
            .stat-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; }

            /* Two Column Row */
            .row { display: grid; grid-template-columns: 2fr 1fr; gap: 30px; margin-bottom: 30px; }
            @media (max-width: 1024px) {
              .row { grid-template-columns: 1fr; }
            }

            .card {
              background: var(--card-bg);
              border: 1px solid var(--border-color);
              border-radius: 16px;
              padding: 24px;
              box-shadow: 0 4px 15px rgba(0,0,0,0.02);
            }
            .card-title-bar {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
            }

            /* Buttons */
            .btn {
              background: var(--primary);
              color: white;
              border: none;
              padding: 10px 18px;
              border-radius: 8px;
              font-weight: 600;
              cursor: pointer;
              font-size: 13px;
              display: inline-flex;
              align-items: center;
              gap: 8px;
              transition: all 0.2s;
              text-decoration: none;
            }
            .btn:hover {
              transform: translateY(-1px);
              box-shadow: 0 4px 12px var(--primary-glow);
            }
            .btn-accent {
              background: var(--accent);
            }
            .btn-accent:hover {
              background: #059669;
            }

            /* Tables styling */
            .table-container { overflow-x: auto; width: 100%; }
            table { width: 100%; border-collapse: collapse; text-align: left; }
            th { 
              padding: 14px 16px; 
              background: var(--table-header);
              border-bottom: 1px solid var(--border-color); 
              color: var(--text-muted); 
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            td { padding: 16px; border-bottom: 1px solid var(--border-color); font-size: 14px; vertical-align: middle; }
            tr.lead-row:hover { background: var(--row-hover); }
            .admin-name-td { color: var(--admin-td-color); font-size: 14px; }

            /* Admin connection buttons */
            .action-btn-connect {
              background: var(--primary-glow);
              color: var(--primary);
              border: 1px solid rgba(99, 102, 241, 0.2);
              padding: 6px 12px;
              border-radius: 6px;
              font-weight: bold;
              text-decoration: none;
              font-size: 12px;
              transition: all 0.2s;
            }
            .action-btn-connect:hover {
              background: var(--primary);
              color: white;
            }

            /* Badge status colors */
            .badge {
              padding: 4px 10px;
              border-radius: 20px;
              font-size: 11px;
              font-weight: 700;
              display: inline-block;
            }
            .badge-new { background: rgba(148, 163, 184, 0.1); color: var(--text-muted); border: 1px solid rgba(148, 163, 184, 0.2); }
            .badge-prospek { background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); }
            .badge-qualified { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; border: 1px solid rgba(139, 92, 246, 0.2); }
            .badge-hot { background: rgba(245, 158, 11, 0.1); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.2); }
            .badge-won { background: rgba(16, 185, 129, 0.1); color: #059669; border: 1px solid rgba(16, 185, 129, 0.2); }
            .badge-lost { background: rgba(244, 63, 94, 0.1); color: #e11d48; border: 1px solid rgba(244, 63, 94, 0.2); }

            /* Custom Pills & Badges */
            .id-badge { background: rgba(255,255,255,0.05); color: var(--text-muted); font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: bold; border: 1px solid var(--border-color); }
            .count-pill { background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; border: 1px solid var(--border-color); }
            .chat-count-badge { background: rgba(56, 189, 248, 0.1); color: #0ea5e9; font-weight: 700; border: 1px solid rgba(56, 189, 248, 0.2); padding: 3px 8px; border-radius: 20px; font-size: 12px; }
            .ref-tag { background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); color: var(--text-muted); font-size: 10px; font-weight: bold; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; }

            /* Status indicator */
            .status-indicator { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; }
            .status-indicator.online { color: var(--accent); }
            .status-indicator.offline { color: #f43f5e; }
            .pulse-dot { width: 8px; height: 8px; background: var(--accent); border-radius: 50%; display: inline-block; box-shadow: 0 0 8px var(--accent); animation: pulse 1.5s infinite; }

            @keyframes pulse {
              0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
              70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
              100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
            }

            /* Custom Form Controls */
            .form-group { display: flex; flex-direction: column; gap: 6px; }
            .form-label { font-size: 13px; color: var(--text-muted); font-weight: 600; }
            .form-input { width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--input-bg); color: var(--text-main); font-size: 14px; transition: border 0.2s; }
            .form-input:focus { border-color: var(--primary); outline: none; }

            /* Advanced Filter Section */
            .filter-card {
              background: var(--card-bg);
              border: 1px solid var(--border-color);
              border-radius: 16px;
              padding: 20px;
              margin-bottom: 25px;
            }
            .filter-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 15px;
            }
            .filter-header-mobile {
              display: none;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 15px;
            }
            .filter-actions {
              display: flex;
              justify-content: flex-end;
              gap: 10px;
              margin-top: 15px;
              border-top: 1px solid var(--border-color);
              padding-top: 15px;
            }

            /* Mobile leads card system */
            .mobile-leads-list { display: none; }
            .mobile-lead-card {
              background: var(--card-bg);
              border: 1px solid var(--border-color);
              border-radius: 16px;
              padding: 16px;
              display: flex;
              flex-direction: column;
              gap: 12px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.01);
              cursor: pointer;
              transition: transform 0.2s, border-color 0.2s;
            }
            .mobile-lead-card:hover {
              transform: translateY(-2px);
              border-color: var(--primary);
            }
            .mobile-card-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 1px solid var(--border-color);
              padding-bottom: 8px;
            }
            .mobile-card-code {
              font-family: monospace;
              color: var(--primary);
              font-weight: 700;
              font-size: 15px;
            }
            .mobile-card-body {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            .mobile-card-field {
              display: flex;
              justify-content: space-between;
              font-size: 13px;
            }
            .mobile-card-field strong {
              color: var(--text-muted);
              font-weight: 500;
            }
            .mobile-card-field span {
              color: var(--text-main);
              font-weight: 600;
              text-align: right;
            }
            .mobile-card-footer {
              border-top: 1px solid var(--border-color);
              padding-top: 8px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 12px;
            }

            /* Right Slide-out Chat Drawer */
            .chat-drawer-overlay {
              position: fixed;
              top: 0; left: 0; right: 0; bottom: 0;
              background: rgba(0,0,0,0.5);
              z-index: 200;
              opacity: 0;
              pointer-events: none;
              transition: opacity 0.3s ease;
              backdrop-filter: blur(4px);
            }
            .chat-drawer-overlay.open { opacity: 1; pointer-events: auto; }

            .chat-drawer {
              position: fixed;
              top: 0; right: 0; bottom: 0;
              width: 500px;
              max-width: 100%;
              background: var(--bg-color);
              border-left: 1px solid var(--border-color);
              z-index: 201;
              transform: translateX(100%);
              transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
              display: flex;
              flex-direction: column;
              box-shadow: -10px 0 30px rgba(0,0,0,0.25);
            }
            .chat-drawer.open { transform: translateX(0); }

            .chat-drawer-header {
              padding: 20px 24px;
              border-bottom: 1px solid var(--border-color);
              display: flex;
              justify-content: space-between;
              align-items: center;
              background: var(--sidebar-bg);
            }
            .chat-drawer-close { background: none; border: none; color: var(--text-muted); font-size: 24px; cursor: pointer; }
            .chat-drawer-close:hover { color: var(--text-main); }

            .chat-drawer-body {
              flex: 1;
              overflow-y: auto;
              padding: 24px;
              display: flex;
              flex-direction: column;
              gap: 16px;
              background: var(--bg-color);
            }

            /* Chat Bubbles */
            .chat-bubble-container { display: flex; flex-direction: column; max-width: 80%; }
            .chat-bubble-container.admin { align-self: flex-end; align-items: flex-end; }
            .chat-bubble-container.customer { align-self: flex-start; align-items: flex-start; }

            .chat-bubble {
              padding: 12px 16px;
              border-radius: 12px;
              font-size: 14px;
              line-height: 1.45;
              word-break: break-word;
            }
            .admin .chat-bubble { background: var(--primary); color: white; border-bottom-right-radius: 2px; }
            .customer .chat-bubble { background: var(--chat-bubble-customer); color: var(--chat-text-customer); border-bottom-left-radius: 2px; border: 1px solid var(--border-color); }
            
            .chat-time { font-size: 10px; color: var(--text-muted); margin-top: 4px; }

            /* Modal Popups (Connect QR) */
            .modal-overlay {
              position: fixed;
              top: 0; left: 0; right: 0; bottom: 0;
              background: rgba(0,0,0,0.5);
              z-index: 250;
              opacity: 0;
              pointer-events: none;
              transition: opacity 0.3s ease;
              backdrop-filter: blur(4px);
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
            }
            .modal-overlay.open { opacity: 1; pointer-events: auto; }
            .modal-card {
              background: var(--card-bg);
              border: 1px solid var(--border-color);
              border-radius: 16px;
              width: 100%;
              max-width: 380px;
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
              display: flex;
              flex-direction: column;
              overflow: hidden;
            }
            .modal-header {
              padding: 16px 24px;
              border-bottom: 1px solid var(--border-color);
              display: flex;
              justify-content: space-between;
              align-items: center;
              background: var(--sidebar-bg);
            }
            .modal-close { background: none; border: none; color: var(--text-muted); font-size: 24px; cursor: pointer; }
            .modal-close:hover { color: var(--text-main); }

            /* Loader Overlay */
            .loader-overlay {
              position: fixed;
              top: 0; left: 0; right: 0; bottom: 0;
              background: rgba(8, 12, 20, 0.85);
              z-index: 300;
              display: none;
              align-items: center;
              justify-content: center;
              flex-direction: column;
              gap: 20px;
              backdrop-filter: blur(8px);
            }
            .spinner { width: 40px; height: 40px; border: 4px solid var(--border-color); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s infinite linear; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

            /* Responsive design */
            @media (max-width: 1024px) {
              .sidebar { transform: translateX(-100%); }
              .sidebar.open { transform: translateX(0); }
              .main-panel { margin-left: 0; }
              .top-header { padding: 15px 20px; }
            }

            @media (max-width: 768px) {
              .main-content { padding: 20px; }
              .chat-drawer { width: 100%; }
              .row { grid-template-columns: 1fr; }
              
              /* Hide desktop table and show custom mobile lead cards list */
              .desktop-only-table {
                display: none !important;
              }
              .mobile-leads-list {
                display: grid !important;
                gap: 15px;
              }

              /* Collapsible Filters on Mobile */
              .filter-grid {
                display: none;
              }
              .filter-grid.open {
                display: grid;
              }
              .filter-header-mobile {
                display: flex;
              }
            }
          </style>
        </head>
        <body>
          <!-- Sidebar -->
          <div class="sidebar" id="appSidebar">
            <div class="sidebar-header">
              <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                <div class="sidebar-logo">T</div>
                <div class="sidebar-logo-text">TripBwi CRM</div>
              </div>
              <button class="sidebar-close-btn" onclick="toggleSidebar(false)" aria-label="Close menu">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div class="sidebar-menu">
              <a href="#section-analytics" class="menu-item active" onclick="setActiveLink(this)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                Dashboard Analytics
              </a>
              <a href="#section-admins" class="menu-item" onclick="setActiveLink(this)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                Admin CS Accounts
              </a>
              <a href="#section-leads" class="menu-item" onclick="setActiveLink(this)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path></svg>
                Leads Intelligence
              </a>
            </div>

            <div class="sidebar-actions">
              <!-- Theme Toggle -->
              <div class="theme-toggle-container">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></svg>
                  <span>Light Theme</span>
                </div>
                <label class="theme-switch">
                  <input type="checkbox" id="themeCheckbox" onchange="toggleTheme(this.checked)">
                  <span class="slider"></span>
                </label>
              </div>
              <button onclick="triggerCron('/api/cron/ghosting-sweeper', 'Sweeping inactive ghosted leads...')" class="btn btn-accent btn-secondary" style="justify-content: center; width: 100%;">
                🔄 Run Sweeper
              </button>
              <button onclick="triggerCron('/api/cron/gemini-extractor', 'AI is parsing unprocessed messages...')" class="btn" style="justify-content: center; width: 100%;">
                ✨ Run AI Extractor
              </button>
            </div>
          </div>

          <!-- Main Panel Content -->
          <div class="main-panel">
            
            <!-- Top Header -->
            <div class="top-header">
              <div style="display: flex; align-items: center; gap: 15px;">
                <button class="menu-toggle-btn" onclick="toggleSidebar(true)" aria-label="Open menu">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                  </svg>
                </button>
                <div>
                  <h1 style="color: var(--text-main); font-size: 22px;">CRM Core Console</h1>
                  <p style="margin: 3px 0 0 0; color: var(--text-muted); font-size: 13px;">Enterprise Chat Analysis & Data Intelligence Dashboard</p>
                </div>
              </div>
              <div style="font-size: 13px; font-weight: 600; color: var(--text-muted);" class="desktop-only-table">
                System Status: <span class="status-indicator online"><span class="pulse-dot"></span>Active</span>
              </div>
            </div>

            <!-- Content Area -->
            <div class="main-content">
              
              <!-- KPI statistics row -->
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-info">
                    <span class="stat-label">Total Leads</span>
                    <span class="stat-val">${totalLeads}</span>
                  </div>
                  <div class="stat-icon" style="background: rgba(56, 189, 248, 0.1); color: #38bdf8;">📂</div>
                </div>
                <div class="stat-card">
                  <div class="stat-info">
                    <span class="stat-label">Active Prospek</span>
                    <span class="stat-val">${activeLeads}</span>
                  </div>
                  <div class="stat-icon" style="background: rgba(99, 102, 241, 0.1); color: #6366f1;">⚡</div>
                </div>
                <div class="stat-card">
                  <div class="stat-info">
                    <span class="stat-label">Closed Won Revenue</span>
                    <span class="stat-val" style="color: var(--accent);">Rp ${totalRevenue.toLocaleString('id-ID')}</span>
                  </div>
                  <div class="stat-icon" style="background: rgba(16, 185, 129, 0.1); color: var(--accent);">💰</div>
                </div>
                <div class="stat-card">
                  <div class="stat-info">
                    <span class="stat-label">Pending Messages</span>
                    <span class="stat-val" style="color: #f59e0b;">${unprocessedMessagesCount}</span>
                  </div>
                  <div class="stat-icon" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;">💬</div>
                </div>
              </div>

              <!-- Analytics Charts Section -->
              <div id="section-analytics" class="chart-section" style="scroll-margin-top: 100px; margin-bottom: 40px;">
                <h2 style="margin-bottom: 20px; font-size: 20px; border-left: 4px solid var(--primary); padding-left: 10px;">Dashboard Data Analytics</h2>
                <div class="analytics-grid">
                  
                  <!-- Lead Status Distribution Doughnut -->
                  <div class="chart-card">
                    <span class="chart-title">Lead Status Distribution</span>
                    <div class="chart-container">
                      <canvas id="statusChart"></canvas>
                    </div>
                  </div>

                  <!-- Travel Destinations Popularity Bar -->
                  <div class="chart-card">
                    <span class="chart-title">Popular Destinations Interest</span>
                    <div class="chart-container">
                      <canvas id="destChart"></canvas>
                    </div>
                  </div>

                  <!-- Referral Channels Doughnut -->
                  <div class="chart-card">
                    <span class="chart-title">Referral Channels Breakdown</span>
                    <div class="chart-container">
                      <canvas id="refChart"></canvas>
                    </div>
                  </div>

                </div>
              </div>

              <!-- Admin CS & Register Grid Section -->
              <div id="section-admins" style="scroll-margin-top: 100px; margin-bottom: 40px;">
                <h2 style="margin-bottom: 20px; font-size: 20px; border-left: 4px solid var(--primary); padding-left: 10px;">Customer Service Accounts</h2>
                <div class="row">
                  <div class="card">
                    <div class="card-title-bar">
                      <h3 style="font-size: 16px;">WhatsApp Sessions</h3>
                      <span class="id-badge">${admins.length} Active CS Agents</span>
                    </div>
                    <div class="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>CS Agent</th>
                            <th>WhatsApp JID</th>
                            <th>Status Connection</th>
                            <th>Avg Reply Time</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${adminRows || '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Belum ada admin terdaftar.</td></tr>'}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <!-- Form Register Admin -->
                  <div class="card">
                    <div class="card-title-bar">
                      <h3 style="font-size: 16px;">Add Admin CS</h3>
                    </div>
                    <form id="addAdminForm" onsubmit="event.preventDefault(); addAdmin();" style="display: flex; flex-direction: column; gap: 15px;">
                      <div class="form-group">
                        <label class="form-label" for="admin_name">Nama Agent:</label>
                        <input type="text" id="admin_name" class="form-input" required placeholder="e.g. Eko Bagus">
                      </div>
                      <div class="form-group">
                        <label class="form-label" for="admin_phone">Nomor WhatsApp:</label>
                        <input type="text" id="admin_phone" class="form-input" required placeholder="e.g. 6289621284046">
                      </div>
                      <button type="submit" class="btn" style="margin-top: 10px; width: 100%; justify-content: center;">Register CS Account</button>
                    </form>
                  </div>
                </div>
              </div>

              <!-- Leads Database Section -->
              <div id="section-leads" style="scroll-margin-top: 100px; margin-bottom: 40px;">
                <h2 style="margin-bottom: 20px; font-size: 20px; border-left: 4px solid var(--primary); padding-left: 10px;">Leads Intelligence Database</h2>
                
                <!-- Advanced Filters Card -->
                <div class="filter-card">
                  <div class="filter-header-mobile">
                    <h3 style="font-size: 14px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin: 0;">Filters</h3>
                    <button class="btn btn-secondary" onclick="toggleMobileFilters()" style="padding: 6px 12px; font-size: 12px;">Toggle Filters</button>
                  </div>
                  <div class="filter-grid" id="filterGrid">
                    <div class="form-group">
                      <label class="form-label">Search Keyword</label>
                      <input type="text" id="searchKeyword" class="form-input" placeholder="Search customer name, HP, destination..." onkeyup="filterLeads()">
                    </div>
                    <div class="form-group">
                      <label class="form-label">Status Lead</label>
                      <select id="filterStatus" class="form-input" onchange="filterLeads()">
                        <option value="ALL">All Status</option>
                        <option value="NEW">New</option>
                        <option value="PROSPEK">Prospek</option>
                        <option value="QUALIFIED">Qualified</option>
                        <option value="HOT">Hot</option>
                        <option value="CLOSED WON">Closed Won</option>
                        <option value="CLOSED LOST">Closed Lost</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label class="form-label">Referral Source</label>
                      <select id="filterReferral" class="form-input" onchange="filterLeads()">
                        <option value="ALL">All Referrals</option>
                        <option value="instagram">Instagram</option>
                        <option value="tiktok">TikTok</option>
                        <option value="website">Website</option>
                        <option value="rekomendasi">Rekomendasi</option>
                        <option value="facebook">Facebook</option>
                        <option value="lainnya">Lainnya</option>
                        <option value="tidak diketahui">Tidak Diketahui</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label class="form-label">PIC CS Agent</label>
                      <select id="filterAdmin" class="form-input" onchange="filterLeads()">
                        <option value="ALL">All CS Agents</option>
                        ${admins.map(a => `<option value="${a.nama_admin}">${a.nama_admin}</option>`).join('')}
                      </select>
                    </div>
                  </div>
                  <div class="filter-actions">
                    <button class="btn btn-accent btn-secondary" onclick="resetFilters()" style="padding: 8px 16px; font-size: 12px;">Reset Filters</button>
                  </div>
                </div>

                <!-- Table Database (Desktop Only) -->
                <div class="card desktop-only-table" style="padding: 0; overflow: hidden; border-radius: 16px;">
                  <div class="table-container">
                    <table id="leadsTable">
                      <thead>
                        <tr>
                          <th>Kode</th>
                          <th>Pelanggan</th>
                          <th>PIC CS</th>
                          <th>Status</th>
                          <th>Destinasi</th>
                          <th style="text-align: center;">Pax</th>
                          <th>Tgl Trip</th>
                          <th>Referral</th>
                          <th>Nilai Order</th>
                          <th>Catatan / Alerts</th>
                          <th style="text-align: center;">Chats</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${leadRows || '<tr><td colspan="11" style="text-align: center; color: var(--text-muted); padding: 40px;">Belum ada lead terdaftar.</td></tr>'}
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Mobile Card List (Mobile Only) -->
                <div class="mobile-leads-list" id="mobileLeadsList">
                  ${mobileCards || '<div style="text-align: center; color: var(--text-muted); padding: 30px;">Belum ada lead terdaftar.</div>'}
                </div>

              </div>

            </div>
          </div>

          <!-- Chat Slide-out Drawer -->
          <div class="chat-drawer-overlay" id="chatDrawerOverlay" onclick="closeChatDrawer()"></div>
          <div class="chat-drawer" id="chatDrawer">
            <div class="chat-drawer-header">
              <div>
                <h3 id="chatDrawerTitle" style="color: var(--text-main); font-size: 16px;">WhatsApp Chat Logs</h3>
                <span id="chatDrawerSubtitle" style="font-size: 12px; color: var(--text-muted); font-family: monospace;">LD-TEST</span>
              </div>
              <button class="chat-drawer-close" onclick="closeChatDrawer()">&times;</button>
            </div>
            <div class="chat-drawer-body" id="chatDrawerBody">
              <!-- Bubbles will populate dynamically -->
            </div>
          </div>

          <!-- QR Connection Modal -->
          <div class="modal-overlay" id="qrModalOverlay" onclick="closeQrModal()">
            <div class="modal-card" onclick="event.stopPropagation()">
              <div class="modal-header">
                <h3 style="color: var(--text-main); font-size: 16px;" id="qrModalTitle">Connect WhatsApp</h3>
                <button class="modal-close" onclick="closeQrModal()">&times;</button>
              </div>
              <div class="modal-body" style="text-align: center; padding: 25px 20px;">
                <p id="qrModalStatus" style="color: var(--text-muted); margin-bottom: 20px; font-size: 14px;">Initializing connection session...</p>
                <div id="qrModalLoading" class="spinner" style="margin: 20px auto; width: 35px; height: 35px;"></div>
                <div id="qrModalFrameContainer" style="display: none; width: 100%; height: 330px; overflow: hidden; border-radius: 8px; border: 1px solid var(--border-color);">
                  <iframe id="qrIframe" src="" style="width: 100%; height: 100%; border: none; overflow: hidden;" scrolling="no"></iframe>
                </div>
              </div>
            </div>
          </div>

          <!-- Loading Spinner Overlay -->
          <div class="loader-overlay" id="loaderOverlay">
            <div class="spinner"></div>
            <h3 id="loaderText" style="color: white;">Processing Data...</h3>
          </div>

          <!-- Chart.js and Theme Config Scripts -->
          <script>
            // Sidebar toggle for mobile responsive view
            function toggleSidebar(isOpen) {
              const sidebar = document.getElementById('appSidebar');
              if (isOpen) {
                sidebar.classList.add('open');
              } else {
                sidebar.classList.remove('open');
              }
            }

            // Collapsible mobile filters
            function toggleMobileFilters() {
              const grid = document.getElementById('filterGrid');
              grid.classList.toggle('open');
            }

            // Theme Mode config
            window.onload = function() {
              // Load Saved Theme
              const savedTheme = localStorage.getItem('theme') || 'dark';
              if (savedTheme === 'light') {
                document.body.classList.add('light-mode');
                document.getElementById('themeCheckbox').checked = true;
              }
              
              // Load Charts
              renderCharts();
            }

            // Toggle Light/Dark Theme
            function toggleTheme(isLight) {
              if (isLight) {
                document.body.classList.add('light-mode');
                localStorage.setItem('theme', 'light');
              } else {
                document.body.classList.remove('light-mode');
                localStorage.setItem('theme', 'dark');
              }
              window.location.reload();
            }

            // Set active sidebar navigation link
            function setActiveLink(element) {
              document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
              element.classList.add('active');
              // Auto close sidebar on mobile after clicking link
              if (window.innerWidth <= 1024) {
                toggleSidebar(false);
              }
            }

            // Chart Data passed from prisma
            const chartData = {
              status: ${JSON.stringify(statusCounts)},
              destinations: ${JSON.stringify(destCounts)},
              referrals: ${JSON.stringify(refCounts)}
            };

            function renderCharts() {
              const isLight = document.body.classList.contains('light-mode');
              const textPrimary = isLight ? '#0f172a' : '#f8fafc';
              const borderTheme = isLight ? '#ffffff' : '#0b0f19';

              // 1. Lead Status Doughnut Chart
              const statusCtx = document.getElementById('statusChart').getContext('2d');
              new Chart(statusCtx, {
                type: 'doughnut',
                data: {
                  labels: Object.keys(chartData.status),
                  datasets: [{
                    data: Object.values(chartData.status),
                    backgroundColor: ['#3b82f6', '#8b5cf6', '#d97706', '#059669', '#e11d48', '#64748b'],
                    borderWidth: 2,
                    borderColor: borderTheme
                  }]
                },
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { color: textPrimary, font: { family: 'Inter', size: 11 } }
                    }
                  }
                }
              });

              // 2. Destinations Bar Chart
              const destLabels = Object.keys(chartData.destinations);
              const destValues = Object.values(chartData.destinations);
              const destCtx = document.getElementById('destChart').getContext('2d');
              new Chart(destCtx, {
                type: 'bar',
                data: {
                  labels: destLabels.length > 0 ? destLabels : ['No Data'],
                  datasets: [{
                    label: 'Leads Interested',
                    data: destValues.length > 0 ? destValues : [0],
                    backgroundColor: 'rgba(99, 102, 241, 0.75)',
                    borderColor: '#6366f1',
                    borderWidth: 1,
                    borderRadius: 4
                  }]
                },
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false }
                  },
                  scales: {
                    x: { ticks: { color: textPrimary } },
                    y: { ticks: { color: textPrimary, stepSize: 1 }, grid: { color: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.04)' } }
                  }
                }
              });

              // 3. Referrals Pie Chart
              const refCtx = document.getElementById('refChart').getContext('2d');
              new Chart(refCtx, {
                type: 'pie',
                data: {
                  labels: Object.keys(chartData.referrals),
                  datasets: [{
                    data: Object.values(chartData.referrals),
                    backgroundColor: ['#ec4899', '#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'],
                    borderWidth: 1,
                    borderColor: borderTheme
                  }]
                },
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { color: textPrimary, font: { family: 'Inter', size: 11 } }
                    }
                  }
                }
              });
            }

            // Advanced Filtering function
            function filterLeads() {
              const searchKeyword = document.getElementById('searchKeyword').value.toLowerCase();
              const selectedStatus = document.getElementById('filterStatus').value;
              const selectedReferral = document.getElementById('filterReferral').value;
              const selectedAdmin = document.getElementById('filterAdmin').value;

              // Filter table rows
              const rows = document.querySelectorAll('#leadsTable tbody tr.lead-row');
              rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                const status = row.getAttribute('data-status');
                const referral = row.getAttribute('data-referral');
                const admin = row.getAttribute('data-admin');

                const matchesSearch = text.includes(searchKeyword);
                const matchesStatus = selectedStatus === 'ALL' || status === selectedStatus;
                const matchesReferral = selectedReferral === 'ALL' || referral === selectedReferral;
                const matchesAdmin = selectedAdmin === 'ALL' || admin === selectedAdmin;

                if (matchesSearch && matchesStatus && matchesReferral && matchesAdmin) {
                  row.style.display = '';
                } else {
                  row.style.display = 'none';
                }
              });

              // Filter mobile cards
              const cards = document.querySelectorAll('.mobile-lead-card');
              cards.forEach(card => {
                const text = card.innerText.toLowerCase();
                const status = card.getAttribute('data-status');
                const referral = card.getAttribute('data-referral');
                const admin = card.getAttribute('data-admin');

                const matchesSearch = text.includes(searchKeyword);
                const matchesStatus = selectedStatus === 'ALL' || status === selectedStatus;
                const matchesReferral = selectedReferral === 'ALL' || referral === selectedReferral;
                const matchesAdmin = selectedAdmin === 'ALL' || admin === selectedAdmin;

                if (matchesSearch && matchesStatus && matchesReferral && matchesAdmin) {
                  card.style.display = 'flex';
                } else {
                  card.style.display = 'none';
                }
              });
            }

            // Reset all database filters
            function resetFilters() {
              document.getElementById('searchKeyword').value = '';
              document.getElementById('filterStatus').value = 'ALL';
              document.getElementById('filterReferral').value = 'ALL';
              document.getElementById('filterAdmin').value = 'ALL';
              filterLeads();
            }

            // In-app QR connection modal management
            let qrInterval = null;

            function openQrModal(adminId, adminName) {
              const overlay = document.getElementById('qrModalOverlay');
              const title = document.getElementById('qrModalTitle');
              const statusText = document.getElementById('qrModalStatus');
              const spinner = document.getElementById('qrModalLoading');
              const frameContainer = document.getElementById('qrModalFrameContainer');
              const iframe = document.getElementById('qrIframe');

              title.innerText = 'Connect WhatsApp: ' + adminName;
              statusText.innerText = 'Initializing WhatsApp session. Generating QR Code...';
              spinner.style.display = 'block';
              frameContainer.style.display = 'none';
              
              const isLight = document.body.classList.contains('light-mode');
              iframe.src = '/api/admins/' + adminId + '/session?theme=' + (isLight ? 'light' : 'dark');
              
              overlay.classList.add('open');

              // Display the iframe once the redirect completes
              setTimeout(() => {
                spinner.style.display = 'none';
                frameContainer.style.display = 'block';
                statusText.innerText = 'Scan the QR code below using WhatsApp Link Device:';
              }, 4000);

              // Set interval to poll connection status
              if(qrInterval) clearInterval(qrInterval);
              qrInterval = setInterval(async () => {
                try {
                  const res = await fetch('/api/admins/' + adminId + '/status-json');
                  const data = await res.json();
                  if (data.connected) {
                    clearInterval(qrInterval);
                    statusText.innerText = 'WhatsApp Connected Successfully!';
                    statusText.style.color = '#10b981';
                    frameContainer.style.display = 'none';
                    spinner.style.display = 'block';
                    
                    setTimeout(() => {
                      closeQrModal();
                      window.location.reload();
                    }, 2000);
                  }
                } catch(e) {}
              }, 3000);
            }

            function closeQrModal() {
              document.getElementById('qrModalOverlay').classList.remove('open');
              document.getElementById('qrIframe').src = '';
              if(qrInterval) clearInterval(qrInterval);
            }

            // Trigger manual cron job with overlay loading feedback
            async function triggerCron(path, text) {
              const overlay = document.getElementById('loaderOverlay');
              const overlayText = document.getElementById('loaderText');
              overlayText.innerText = text;
              overlay.style.display = 'flex';

              try {
                const res = await fetch(path, { method: 'POST' });
                const data = await res.json();
                overlay.style.display = 'none';
                
                if(data.success) {
                  alert(data.message || 'AI Extraction completed successfully!');
                } else {
                  alert('Error: ' + data.error);
                }
                window.location.reload();
              } catch(e) {
                overlay.style.display = 'none';
                alert('Request failed: ' + e.message);
              }
            }

            // Register new admin account CS
            async function addAdmin() {
              const name = document.getElementById('admin_name').value;
              const phone = document.getElementById('admin_phone').value;
              
              const res = await fetch('/api/admins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nama_admin: name, nomor_wa: phone })
              });
              
              const data = await res.json();
              if (res.ok) {
                alert('Admin added successfully!');
                window.location.reload();
              } else {
                alert('Error: ' + data.error);
              }
            }

            // Open chat logs drawer dynamically
            async function openChatDrawer(leadId, kodeLead, customerHp, customerName) {
              const overlay = document.getElementById('chatDrawerOverlay');
              const drawer = document.getElementById('chatDrawer');
              const title = document.getElementById('chatDrawerTitle');
              const subtitle = document.getElementById('chatDrawerSubtitle');
              const body = document.getElementById('chatDrawerBody');

              title.innerText = customerName ? customerName : 'Pelanggan WA';
              subtitle.innerText = kodeLead + ' • ' + customerHp;
              body.innerHTML = '<div style="text-align: center; color: var(--text-muted); margin-top: 50px;"><div class="spinner" style="width:30px; height:30px; margin:0 auto 10px;"></div>Loading messages history...</div>';
              
              overlay.classList.add('open');
              drawer.classList.add('open');

              try {
                const res = await fetch('/api/leads/' + leadId + '/messages');
                const json = await res.json();
                
                if (json.success && json.data.length > 0) {
                  body.innerHTML = '';
                  json.data.forEach(msg => {
                    const bubble = document.createElement('div');
                    bubble.className = 'chat-bubble-container ' + (msg.pengirim === 'admin' ? 'admin' : 'customer');
                    
                    const timeStr = new Date(msg.waktu_pesan).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    const dateStr = new Date(msg.waktu_pesan).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                    
                    bubble.innerHTML = '<div class="chat-bubble">' + msg.pesan + '</div>' +
                                       '<div class="chat-time">' + dateStr + ', ' + timeStr + '</div>';
                    body.appendChild(bubble);
                  });
                  // Auto scroll to bottom
                  body.scrollTop = body.scrollHeight;
                } else {
                  body.innerHTML = '<div style="text-align: center; color: var(--text-muted); margin-top: 100px;">No messages found in this thread.</div>';
                }
              } catch (e) {
                body.innerHTML = '<div style="text-align: center; color: #fca5a5; margin-top: 100px;">Failed to load chat history.</div>';
              }
            }

            // Close chat logs drawer
            function closeChatDrawer() {
              document.getElementById('chatDrawerOverlay').classList.remove('open');
              document.getElementById('chatDrawer').classList.remove('open');
            }
          </script>
        </body>
      </html>
    `);
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
