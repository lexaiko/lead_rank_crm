import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import qrcode from 'qrcode-terminal';
import { prisma } from '../config/prisma.js';
import { normalizePhoneNumber } from '../utils/phone.js';

// Store active sockets and QRs in memory
export const activeSockets = new Map();
export const activeQrs = new Map();

// LID to Phone Number JID mapping cache
export let lidToPhoneMap = new Map();
const MAPPING_FILE = 'sessions/lid-mapping.json';

function loadLidMapping() {
  try {
    if (!fs.existsSync('sessions')) {
      fs.mkdirSync('sessions');
    }
    if (fs.existsSync(MAPPING_FILE)) {
      const data = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf-8'));
      lidToPhoneMap = new Map(Object.entries(data));
      console.log(`[LID Mapping] Loaded ${lidToPhoneMap.size} mappings from file.`);
      
      // Trigger database merge for all loaded mappings on startup to clean up residual duplicates
      for (const [lid, phone] of lidToPhoneMap.entries()) {
        mergeLidCustomerRecord(lid, phone).catch(err => {
          console.error(`[LID Mapping] Async startup merge failed for ${lid} -> ${phone}:`, err);
        });
      }
    }
  } catch (e) {
    console.error('Failed to load LID mapping file:', e);
  }
}

function saveLidMapping() {
  try {
    const obj = Object.fromEntries(lidToPhoneMap.entries());
    fs.writeFileSync(MAPPING_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save LID mapping file:', e);
  }
}

async function mergeLidCustomerRecord(lid, phone) {
  try {
    const lidCust = await prisma.customer.findUnique({
      where: { nomor_hp: lid },
      include: { leads: { include: { messages: true } } }
    });
    
    if (!lidCust) return;
    
    const phoneCust = await prisma.customer.findUnique({
      where: { nomor_hp: phone },
      include: { leads: true }
    });
    
    if (phoneCust) {
      console.log(`[LID Merge] Merging duplicate customer JID ${lid} into ${phone}...`);
      
      // Get target lead for the real phone customer
      let targetLead = phoneCust.leads[0];
      if (!targetLead) {
        const kode_lead = `LD${phone}-${Date.now().toString().slice(-6)}`;
        targetLead = await prisma.lead.create({
          data: {
            kode_lead,
            customer_id: phoneCust.id,
            admin_id: lidCust.leads[0]?.admin_id || 10,
            status_lead: 'NEW'
          }
        });
      }
      
      // Move all messages to the target lead
      for (const lead of lidCust.leads) {
        await prisma.chatMessage.updateMany({
          where: { lead_id: lead.id },
          data: { lead_id: targetLead.id }
        });
      }
      
      // Delete the duplicate LID customer record
      await prisma.customer.delete({
        where: { id: lidCust.id }
      });
      console.log(`[LID Merge] Successfully merged duplicate customer JID ${lid}.`);
    } else {
      // Rename the LID phone JID to phone
      await prisma.customer.update({
        where: { id: lidCust.id },
        data: { nomor_hp: phone }
      });
      console.log(`[LID Merge] Phone customer did not exist. Renamed LID customer ${lid} to phone JID ${phone}.`);
    }
  } catch (err) {
    console.error(`[LID Merge] Failed to merge customer ${lid} into ${phone}:`, err);
  }
}

async function registerLidMapping(lid, phone) {
  if (!lid || !phone) return;
  const cleanLid = normalizePhoneNumber(lid);
  const cleanPhone = normalizePhoneNumber(phone);
  if (cleanLid && cleanPhone && cleanLid !== cleanPhone) {
    if (lidToPhoneMap.get(cleanLid) !== cleanPhone) {
      lidToPhoneMap.set(cleanLid, cleanPhone);
      console.log(`[LID Mapping] Registered mapping: ${cleanLid} -> ${cleanPhone}`);
      saveLidMapping();
      
      // Run merge synchronously (awaited) to prevent race conditions during handleIncomingMessage
      await mergeLidCustomerRecord(cleanLid, cleanPhone);
    }
  }
}

// Load mappings immediately on load
loadLidMapping();

/**
 * Start a WhatsApp connection session for an Admin.
 * 
 * @param {number} adminId 
 */
export async function startAdminSession(adminId) {
  // If socket already exists, close it first
  if (activeSockets.has(adminId)) {
    try {
      const existingSock = activeSockets.get(adminId);
      existingSock.isManualShutdown = true; // Prevent old socket close event from triggering a reconnect loop
      existingSock.end();
    } catch (e) {
      // Ignore errors closing previous socket
    }
    activeSockets.delete(adminId);
  }

  console.log(`Starting WhatsApp session for Admin ID: ${adminId}`);

  const { state, saveCreds } = await useMultiFileAuthState(`sessions/${adminId}`);

  const makeWASocketFn = makeWASocket.default || makeWASocket;
  const sock = makeWASocketFn({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false // We will print it manually
  });

  activeSockets.set(adminId, sock);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      activeQrs.set(adminId, qr);
      console.log(`\n--- QR Code for Admin ID: ${adminId} ---`);
      qrcode.generate(qr, { small: true });
      console.log(`Scan the QR code above to connect.\n`);
    }

    if (connection === 'open') {
      activeQrs.delete(adminId);
      console.log(`WhatsApp connection opened successfully for Admin ID: ${adminId}`);
      
      // Update database status if needed
      const normalizedWa = normalizePhoneNumber(sock.user.id);
      console.log(`Admin ID ${adminId} is logged in with number: ${normalizedWa}`);
    }

    if (connection === 'close') {
      activeQrs.delete(adminId);
      
      if (sock.isManualShutdown) {
        console.log(`Connection closed (Manual Shutdown) for Admin ID: ${adminId}. Skipping reconnect.`);
        return;
      }
      
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`Connection closed for Admin ID: ${adminId}. Reason code: ${statusCode}. Reconnecting: ${shouldReconnect}`);

      if (shouldReconnect) {
        // Delay reconnection to avoid rapid loops
        setTimeout(() => {
          startAdminSession(adminId);
        }, 5000);
      } else {
        console.log(`Logged out. Cleaning up session files for Admin ID: ${adminId}`);
        activeSockets.delete(adminId);
        try {
          fs.rmSync(`sessions/${adminId}`, { recursive: true, force: true });
        } catch (err) {
          console.error(`Failed to delete session files: ${err.message}`);
        }
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // Sync contacts from phone address book
  sock.ev.on('contacts.set', async ({ contacts }) => {
    for (const c of contacts) {
      if (c.lid && c.id) {
        await registerLidMapping(c.lid, c.id);
      }
      await updateCustomerFromContact(c);
    }
  });

  sock.ev.on('contacts.update', async (updates) => {
    for (const c of updates) {
      if (c.lid && c.id) {
        await registerLidMapping(c.lid, c.id);
      }
      await updateCustomerFromContact(c);
    }
  });

  sock.ev.on('contacts.upsert', async (newContacts) => {
    for (const c of newContacts) {
      if (c.lid && c.id) {
        await registerLidMapping(c.lid, c.id);
      }
      await updateCustomerFromContact(c);
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    console.log('[WhatsApp Event] messages.upsert triggered:', JSON.stringify(m, null, 2));
    if (m.type !== 'notify') return;

    for (const msg of m.messages) {
      try {
        console.log('[WhatsApp Event] Handling message:', JSON.stringify(msg, null, 2));
        await handleIncomingMessage(sock, msg, adminId);
      } catch (err) {
        console.error('Error handling WhatsApp message event:', err);
      }
    }
  });
}

/**
 * Extracts raw text from a Baileys message object.
 */
function extractMessageText(message) {
  if (!message) return '';
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  if (message.documentMessage?.caption) return message.documentMessage.caption;
  
  // Ephemeral or view once messages
  if (message.ephemeralMessage?.message) return extractMessageText(message.ephemeralMessage.message);
  if (message.viewOnceMessage?.message) return extractMessageText(message.viewOnceMessage.message);
  if (message.viewOnceMessageV2?.message) return extractMessageText(message.viewOnceMessageV2.message);
  
  return '';
}

/**
 * Handles incoming/outgoing messages tracked by Baileys.
 */
async function handleIncomingMessage(sock, msg, adminId) {
  // 0. Ignore WhatsApp status updates, story broadcasts, and group chats
  const remoteJidRaw = msg.key.remoteJid;
  if (
    !remoteJidRaw ||
    remoteJidRaw === 'status@broadcast' ||
    remoteJidRaw.endsWith('@g.us') ||
    remoteJidRaw.includes('broadcast') ||
    msg.broadcast === true
  ) {
    return;
  }

  // 1. Identify Admin PIC
  // We double check the admin using the passed adminId, verify they exist and are active
  const admin = await prisma.admin.findUnique({
    where: { id: adminId }
  });

  if (!admin || !admin.is_active) {
    console.log(`Admin ID ${adminId} is not active or not found. Ignoring message tracking.`);
    return;
  }

  // 2. Identify Sender & Extract Text
  const fromMe = msg.key.fromMe;
  const pengirim = fromMe ? 'admin' : 'customer';
  
  const text = extractMessageText(msg.message);
  if (!text || !text.trim()) {
    return; // Ignore empty texts/media with no captions
  }

  // 3. Identify Customer
  let remoteJid = msg.key.remoteJid;

  // Register mapping if we see both LID and PN JID in the message key
  if (remoteJidRaw.endsWith('@lid') && msg.key.remoteJidAlt?.endsWith('@s.whatsapp.net')) {
    await registerLidMapping(remoteJidRaw, msg.key.remoteJidAlt);
  }

  // Prioritize remoteJidAlt if present to handle newer WhatsApp LID mapping (ends with @lid)
  if (msg.key.remoteJidAlt && msg.key.remoteJidAlt.endsWith('@s.whatsapp.net')) {
    remoteJid = msg.key.remoteJidAlt;
  }

  // Resolve Phone Number JID from memory mapping if remoteJid is a LID JID
  if (remoteJid && remoteJid.endsWith('@lid')) {
    const cleanLid = normalizePhoneNumber(remoteJid);
    const mappedPhone = lidToPhoneMap.get(cleanLid);
    if (mappedPhone) {
      remoteJid = mappedPhone + '@s.whatsapp.net';
    }
  }

  // Ignore status broadcast, groups, and LID fallback that cannot be resolved to a phone number
  if (!remoteJid || (!remoteJid.endsWith('@s.whatsapp.net') && !remoteJid.endsWith('@lid'))) {
    return;
  }

  const customerHp = normalizePhoneNumber(remoteJid);
  if (!customerHp) return;

  let customer = await prisma.customer.findUnique({
    where: { nomor_hp: customerHp }
  });

  if (!customer) {
    // Try to get contact name from Baileys contacts cache first
    const socketContact = sock.contacts?.[remoteJid];
    let contactName = socketContact?.name || socketContact?.verifiedName || socketContact?.notify || null;

    // Fallback to pushName if message is from the customer
    if (!contactName && !fromMe) {
      contactName = msg.pushName || null;
    }

    try {
      customer = await prisma.customer.create({
        data: {
          nomor_hp: customerHp,
          nama_kontak: contactName
        }
      });
    } catch (createErr) {
      // If it throws unique constraint error (P2002), another concurrent request created it.
      // Simply query the newly created record.
      if (createErr.code === 'P2002') {
        customer = await prisma.customer.findUnique({
          where: { nomor_hp: customerHp }
        });
      } else {
        throw createErr;
      }
    }
  } else {
    // Auto-correct contact name if it's currently null/placeholder or was incorrectly set to the admin's name
    if (!fromMe && msg.pushName) {
      const allAdmins = await prisma.admin.findMany({ select: { nama_admin: true } });
      const adminNames = allAdmins.map(a => a.nama_admin.toLowerCase());
      const currentNameLower = customer.nama_kontak?.toLowerCase();
      const currentSockName = sock.user?.name?.toLowerCase();

      const isIncorrectName = !customer.nama_kontak || 
                              (currentSockName && currentNameLower === currentSockName) ||
                              adminNames.includes(currentNameLower);

      if (isIncorrectName) {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: { nama_kontak: msg.pushName }
        });
      }
    }
  }

  // 4. Pengecekan Lead
  let lead = await prisma.lead.findFirst({
    where: {
      customer_id: customer.id,
      NOT: [
        { status_lead: 'CLOSED WON' },
        { status_lead: 'CLOSED LOST' }
      ]
    }
  });

  // 5. Buat Lead Baru if none active
  if (!lead) {
    const kode_lead = `LD${customerHp}-${Date.now().toString().slice(-6)}`;
    try {
      lead = await prisma.lead.create({
        data: {
          kode_lead,
          customer_id: customer.id,
          admin_id: admin.id,
          status_lead: 'NEW'
        }
      });
      console.log(`Created new active lead ${kode_lead} for customer ${customerHp}`);
    } catch (leadErr) {
      // If lead creation fails due to race conditions, query the active lead again
      lead = await prisma.lead.findFirst({
        where: {
          customer_id: customer.id,
          NOT: [
            { status_lead: 'CLOSED WON' },
            { status_lead: 'CLOSED LOST' }
          ]
        }
      });
      if (!lead) throw leadErr;
    }
  }

  // 6. Simpan Pesan to ChatMessage
  const waktu_pesan = msg.messageTimestamp 
    ? new Date(Number(msg.messageTimestamp) * 1000) 
    : new Date();

  // Run in transaction to insert chat message and update Lead's updatedAt
  await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        lead_id: lead.id,
        pengirim,
        pesan: text,
        waktu_pesan,
        is_processed_by_ai: false
      }
    }),
    prisma.lead.update({
      where: { id: lead.id },
      data: { updatedAt: new Date() } // Touch lead's updatedAt
    })
  ]);

  console.log(`[${pengirim}] saved for Lead ID ${lead.id}: "${text.slice(0, 30)}..."`);
}

/**
 * Updates or creates a customer from a Baileys contact object synchronized from phone/WhatsApp.
 * 
 * @param {object} contact 
 */
async function updateCustomerFromContact(contact) {
  try {
    let jid = contact.id;
    if (!jid || (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid'))) {
      return;
    }

    // Apply LID-to-Phone JID mapping to avoid recreating LID JID customer records on contact sync events
    if (jid.endsWith('@lid')) {
      const cleanLid = normalizePhoneNumber(jid);
      const mappedPhone = lidToPhoneMap.get(cleanLid);
      if (mappedPhone) {
        jid = mappedPhone + '@s.whatsapp.net';
      }
    }

    const customerHp = normalizePhoneNumber(jid);
    if (!customerHp) return;

    // Use phone book name, business verified name, or pushName
    const contactName = contact.name || contact.verifiedName || contact.notify || null;
    if (!contactName) return;

    // Fetch active admins to filter out admin numbers and pushNames
    const admins = await prisma.admin.findMany();
    const adminPhones = admins.map(a => normalizePhoneNumber(a.nomor_wa));
    const adminNames = admins.map(a => a.nama_admin.toLowerCase());

    // If this contact belongs to an admin, do not store as customer
    if (adminPhones.includes(customerHp)) {
      return;
    }

    const contactNameLower = contactName.toLowerCase();
    const isIncorrectName = contactName.startsWith('./') || 
                            contactName.includes('%') ||
                            adminNames.includes(contactNameLower);

    if (isIncorrectName) {
      return;
    }

    // Only update the customer's contact name if the customer already exists in our database.
    // We do not want to create new customer records for every phonebook contact or story author who hasn't chatted with us.
    const existingCustomer = await prisma.customer.findUnique({
      where: { nomor_hp: customerHp }
    });

    if (existingCustomer) {
      await prisma.customer.update({
        where: { id: existingCustomer.id },
        data: { nama_kontak: contactName }
      });
      console.log(`[Contacts Sync] Updated name for HP ${customerHp}: "${contactName}"`);
    }
  } catch (err) {
    console.error(`Failed to update customer from contact sync event:`, err);
  }
}
