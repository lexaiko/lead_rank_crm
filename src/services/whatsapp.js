import makeWASocket, { DisconnectReason, useMultiFileAuthState, BufferJSON, downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import qrcode from 'qrcode-terminal';
import { prisma } from '../config/prisma.js';
import { normalizePhoneNumber } from '../utils/phone.js';
import { enqueueAIJob } from './ai-queue.js';
import { detectReferralSourceFromGreeting } from './greeting-rules.js';

function logDebug(...args) {
  if (process.env.BAILEYS_LOG_LEVEL && process.env.BAILEYS_LOG_LEVEL !== 'silent') {
    console.log(...args);
  }
}

// Queue to serialize database operations (reads and writes) per admin session to prevent race conditions and concurrent transaction conflicts (MySQL 1020 errors)
const dbWriteQueues = new Map();

function enqueueDbWrite(adminId, operation) {
  if (!dbWriteQueues.has(adminId)) {
    dbWriteQueues.set(adminId, Promise.resolve());
  }
  const currentQueue = dbWriteQueues.get(adminId);
  const nextQueue = currentQueue.then(async () => {
    try {
      return await operation();
    } catch (err) {
      console.error(`[Prisma AuthState Queue Error] for admin ${adminId}:`, err.message);
      throw err;
    }
  });
  // Maintain the chain by catching errors for the stored queue head
  dbWriteQueues.set(adminId, nextQueue.catch(() => {}));
  return nextQueue;
}

/**
 * Custom Prisma-backed authentication state provider for Baileys.
 * Saves credentials and keys directly in the MySQL database to support stateless/cloud production runs.
 * Supports fallback to queryRaw if Prisma Client was not regenerated yet due to locked files.
 * 
 * @param {number} adminId 
 */
export async function usePrismaAuthState(adminId) {
  const getRecord = async (key) => {
    return enqueueDbWrite(adminId, async () => {
      try {
        if (prisma.whatsAppSession) {
          return await prisma.whatsAppSession.findUnique({
            where: { admin_id_key: { admin_id: adminId, key } }
          });
        } else {
          const rows = await prisma.$queryRawUnsafe(
            'SELECT * FROM WhatsAppSession WHERE admin_id = ? AND `key` = ?',
            adminId,
            key
          );
          return rows[0] || null;
        }
      } catch (err) {
        console.error(`[Prisma AuthState] Failed to get key ${key}:`, err.message);
        return null;
      }
    });
  };

  const upsertRecord = async (key, value) => {
    return enqueueDbWrite(adminId, async () => {
      if (prisma.whatsAppSession) {
        await prisma.whatsAppSession.upsert({
          where: { admin_id_key: { admin_id: adminId, key } },
          create: { admin_id: adminId, key, value },
          update: { value }
        });
      } else {
        await prisma.$executeRawUnsafe(
          'INSERT INTO WhatsAppSession (admin_id, `key`, value, createdAt, updatedAt) VALUES (?, ?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE value = ?, updatedAt = NOW()',
          adminId,
          key,
          value,
          value
        );
      }
    });
  };

  const deleteRecord = async (key) => {
    return enqueueDbWrite(adminId, async () => {
      if (prisma.whatsAppSession) {
        // Use deleteMany instead of delete so it silently no-ops if record doesn't exist
        await prisma.whatsAppSession.deleteMany({
          where: { admin_id: adminId, key }
        });
      } else {
        await prisma.$executeRawUnsafe(
          'DELETE FROM WhatsAppSession WHERE admin_id = ? AND `key` = ?',
          adminId,
          key
        ).catch(() => {});
      }
    });
  };

  const getCreds = async () => {
    const record = await getRecord('creds');
    if (record) {
      return JSON.parse(record.value, BufferJSON.reviver);
    }
    return null;
  };

  const saveCreds = async (creds) => {
    const value = JSON.stringify(creds, BufferJSON.replacer);
    await upsertRecord('creds', value);
  };

  let creds = await getCreds();
  if (!creds) {
    const { initAuthCreds } = await import('@whiskeysockets/baileys');
    creds = initAuthCreds();
    await saveCreds(creds);
  }

  const state = {
    creds,
    keys: {
      get: async (type, ids) => {
        const data = {};
        await Promise.all(
          ids.map(async (id) => {
            const dbKey = `${type}-${id}`;
            const record = await getRecord(dbKey);
            if (record) {
              let val = JSON.parse(record.value, BufferJSON.reviver);
              if (type === 'app-state-sync-key' && val) {
                const { proto } = await import('@whiskeysockets/baileys');
                val = proto.Message.AppStateSyncKeyData.fromObject(val);
              }
              data[id] = val;
            }
          })
        );
        return data;
      },
      set: async (data) => {
        const promises = [];
        for (const type of Object.keys(data)) {
          for (const id of Object.keys(data[type])) {
            const value = data[type][id];
            const dbKey = `${type}-${id}`;
            if (value) {
              const valStr = JSON.stringify(value, BufferJSON.replacer);
              promises.push(upsertRecord(dbKey, valStr));
            } else {
              promises.push(deleteRecord(dbKey));
            }
          }
        }
        await Promise.all(promises);
      }
    }
  };

  return {
    state,
    saveCreds: async () => {
      await saveCreds(state.creds);
    }
  };
}

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

      // Perform database cleanup on startup to merge any existing duplicate LID customer records
      setTimeout(async () => {
        console.log('[LID Merge] Running startup cleanup to merge duplicate LID customers...');
        let mergedCount = 0;
        for (const [lid, phone] of lidToPhoneMap.entries()) {
          try {
            const merged = await mergeLidCustomerRecord(lid, phone);
            if (merged) mergedCount++;
          } catch (e) {
            // Ignore individual error
          }
        }
        if (mergedCount > 0) {
          console.log(`[LID Merge] Startup cleanup completed. Merged ${mergedCount} duplicate LID customer records.`);
        }
      }, 5000);
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
      include: { lead: { include: { messages: true } } }
    });

    if (!lidCust) return false;

    const phoneCust = await prisma.customer.findUnique({
      where: { nomor_hp: phone },
      include: { lead: true }
    });

    if (phoneCust) {
      console.log(`[LID Merge] Merging duplicate customer JID ${lid} into ${phone}...`);

      // Get target lead for the real phone customer
      let targetLead = phoneCust.lead;
      if (!targetLead) {
        const adminId = lidCust.lead?.admin_id || 10;
        const kode_lead = await generateKodeLead(adminId);
        targetLead = await prisma.lead.create({
          data: {
            kode_lead,
            customer_id: phoneCust.id,
            admin_id: adminId,
            status_lead: 'NEW'
          }
        });
      }

      // Move all messages to the target lead
      if (lidCust.lead) {
        await prisma.chatMessage.updateMany({
          where: { lead_id: lidCust.lead.id },
          data: { lead_id: targetLead.id }
        });
      }

      // Enqueue the target lead to AI queue
      await enqueueAIJob(targetLead.id);
      
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
    return true;
  } catch (err) {
    console.error(`[LID Merge] Failed to merge customer ${lid} into ${phone}:`, err);
    return false;
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

  const { state, saveCreds } = await usePrismaAuthState(adminId);

  const makeWASocketFn = makeWASocket.default || makeWASocket;
  const sock = makeWASocketFn({
    auth: state,
    logger: pino({ 
      level: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'].includes(process.env.BAILEYS_LOG_LEVEL) 
        ? process.env.BAILEYS_LOG_LEVEL 
        : 'silent' 
    }),
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
        console.log(`Logged out. Cleaning up session database records for Admin ID: ${adminId}`);
        activeSockets.delete(adminId);
        try {
          if (prisma.whatsAppSession) {
            await prisma.whatsAppSession.deleteMany({
              where: { admin_id: adminId }
            });
          } else {
            await prisma.$executeRawUnsafe(
              'DELETE FROM WhatsAppSession WHERE admin_id = ?',
              adminId
            );
          }
        } catch (err) {
          console.error(`Failed to delete database session records: ${err.message}`);
        }
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // Sync contacts and messages from messaging history set (triggered on connection reconnects/syncs)
  sock.ev.on('messaging-history.set', async ({ contacts, messages }) => {
    // 1. Sync contacts/LID mappings
    if (contacts) {
      console.log(`[Contacts Sync] messaging-history.set triggered with ${contacts.length} contacts.`);
      const named = contacts.filter(c => c.name);
      if (named.length > 0) {
        console.log(`[Contacts Sync] Sample named contacts from history (first 3):`, JSON.stringify(named.slice(0, 3), null, 2));
      }
      for (const c of contacts) {
        if (c.lid && c.id) {
          await registerLidMapping(c.lid, c.id);
        }
        await updateCustomerFromContact(c);
      }
    }

    // 2. Process recent messages from history sync to capture chats that occurred while the server was offline
    if (messages && messages.length > 0) {
      console.log(`[History Sync] messaging-history.set triggered with ${messages.length} messages. Processing recent ones.`);
      
      // Sync messages from the last 10 days (handles 1 week server downtime) to catch up missed messages
      const cutoffTime = Math.floor(Date.now() / 1000) - 10 * 24 * 60 * 60; // 10 days ago
      
      let processedCount = 0;
      for (const msg of messages) {
        const timestamp = Number(msg.messageTimestamp || 0);
        if (timestamp >= cutoffTime) {
          try {
            // Process message as history sync
            await handleIncomingMessage(sock, msg, adminId, true);
            processedCount++;
          } catch (err) {
            console.error('[History Sync Error] Failed to handle message:', err);
          }
        }
      }
      console.log(`[History Sync] Processed ${processedCount} recent messages out of ${messages.length} total messages.`);
    }
  });

  // Sync contacts from phone address book
  sock.ev.on('contacts.set', async ({ contacts }) => {
    console.log(`[Contacts Sync] contacts.set triggered with ${contacts.length} contacts.`);
    // Print contacts that have a name property to inspect fields
    const named = contacts.filter(c => c.name);
    if (named.length > 0) {
      console.log(`[Contacts Sync] Sample named contacts (first 3):`, JSON.stringify(named.slice(0, 3), null, 2));
    }
    for (const c of contacts) {
      if (c.lid && c.id) {
        await registerLidMapping(c.lid, c.id);
      }
      await updateCustomerFromContact(c);
    }
  });

  sock.ev.on('contacts.update', async (updates) => {
    logDebug(`[Contacts Sync] contacts.update triggered with ${updates.length} updates.`);
    for (const c of updates) {
      if (c.name || c.notify) {
        logDebug(`[Contacts Sync] Update details:`, JSON.stringify(c, null, 2));
      }
      if (c.lid && c.id) {
        await registerLidMapping(c.lid, c.id);
      }
      await updateCustomerFromContact(c);
    }
  });

  sock.ev.on('contacts.upsert', async (newContacts) => {
    logDebug(`[Contacts Sync] contacts.upsert triggered with ${newContacts.length} new contacts.`);
    for (const c of newContacts) {
      if (c.name || c.notify) {
        logDebug(`[Contacts Sync] Upsert details:`, JSON.stringify(c, null, 2));
      }
      if (c.lid && c.id) {
        await registerLidMapping(c.lid, c.id);
      }
      await updateCustomerFromContact(c);
    }
  });

  // Sync contacts from chat list (always triggered on reconnects/bootup)
  sock.ev.on('chats.set', async ({ chats }) => {
    logDebug(`[Chats Sync] chats.set triggered with ${chats.length} chats.`);
    for (const chat of chats) {
      if (chat.name) {
        await updateCustomerNameFromChat(chat);
      }
    }
  });

  sock.ev.on('chats.upsert', async (newChats) => {
    logDebug(`[Chats Sync] chats.upsert triggered with ${newChats.length} chats.`);
    for (const chat of newChats) {
      if (chat.name) {
        await updateCustomerNameFromChat(chat);
      }
    }
  });

  sock.ev.on('chats.update', async (updates) => {
    logDebug(`[Chats Sync] chats.update triggered with ${updates.length} updates.`);
    for (const chat of updates) {
      if (chat.name) {
        await updateCustomerNameFromChat(chat);
      }
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    logDebug('[WhatsApp Event] messages.upsert triggered:', JSON.stringify(m, null, 2));
    if (m.type !== 'notify' && m.type !== 'append') return;

    // Both 'notify' (real-time) and 'append' (missed messages since last disconnect)
    // are treated as real messages — not history. 'append' contains messages that came
    // in while the server was down, so they should create leads and trigger AI jobs normally.
    for (const msg of m.messages) {
      try {
        logDebug('[WhatsApp Event] Handling message:', JSON.stringify(msg, null, 2));
        await handleIncomingMessage(sock, msg, adminId, false);
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
 * Builds a short human-readable description of a Baileys catalog product message.
 */
function describeCatalogProduct(productMessage) {
  const product = productMessage?.product;
  if (!product) return '';
  const parts = [];
  if (product.title) parts.push(`"${product.title}"`);
  if (product.description) parts.push(product.description);
  if (product.priceAmount1000) {
    const price = Number(product.priceAmount1000) / 1000;
    parts.push(`harga ${product.currencyCode || 'IDR'} ${price.toLocaleString('id-ID')}`);
  }
  return parts.join(' - ');
}

/**
 * Extracts business catalog context from a Baileys message:
 * a product sent from the catalog, a cart order, or a reply quoting a catalog product.
 * Returns an empty string when the message has no catalog context.
 */
function extractCatalogContext(message) {
  if (!message) return '';
  if (message.ephemeralMessage?.message) return extractCatalogContext(message.ephemeralMessage.message);
  if (message.viewOnceMessage?.message) return extractCatalogContext(message.viewOnceMessage.message);
  if (message.viewOnceMessageV2?.message) return extractCatalogContext(message.viewOnceMessageV2.message);

  if (message.productMessage) {
    const desc = describeCatalogProduct(message.productMessage);
    return desc ? `[Produk katalog: ${desc}]` : '[Produk katalog]';
  }

  if (message.orderMessage) {
    const order = message.orderMessage;
    const total = order.totalAmount1000
      ? ` total ${order.totalCurrencyCode || 'IDR'} ${(Number(order.totalAmount1000) / 1000).toLocaleString('id-ID')}`
      : '';
    return `[Order dari katalog: ${order.itemCount || 0} item${total}]`;
  }

  const quoted = message.extendedTextMessage?.contextInfo?.quotedMessage;
  if (quoted?.productMessage) {
    const desc = describeCatalogProduct(quoted.productMessage);
    return desc ? `[Membalas produk katalog: ${desc}]` : '[Membalas produk katalog]';
  }

  return '';
}

/**
 * Returns the unwrapped imageMessage node from a Baileys message, or null if the message has no image.
 */
function extractImageMessage(message) {
  if (!message) return null;
  if (message.imageMessage) return message.imageMessage;
  if (message.ephemeralMessage?.message) return extractImageMessage(message.ephemeralMessage.message);
  if (message.viewOnceMessage?.message) return extractImageMessage(message.viewOnceMessage.message);
  if (message.viewOnceMessageV2?.message) return extractImageMessage(message.viewOnceMessageV2.message);
  return null;
}

/**
 * Finds the Baileys contextInfo carrying a quoted (replied-to) message, across message types and wrappers.
 */
function extractContextInfo(message) {
  if (!message) return null;
  if (message.ephemeralMessage?.message) return extractContextInfo(message.ephemeralMessage.message);
  if (message.viewOnceMessage?.message) return extractContextInfo(message.viewOnceMessage.message);
  if (message.viewOnceMessageV2?.message) return extractContextInfo(message.viewOnceMessageV2.message);

  const nodes = [
    message.extendedTextMessage,
    message.imageMessage,
    message.videoMessage,
    message.documentMessage,
    message.audioMessage,
    message.stickerMessage,
    message.buttonsResponseMessage,
    message.templateButtonReplyMessage
  ];
  for (const node of nodes) {
    if (node?.contextInfo?.quotedMessage) return node.contextInfo;
  }
  return null;
}

/**
 * Builds WhatsApp-style reply context fields for a message that quotes another message.
 * Returns { reply_to_wa_id, reply_to_sender, reply_to_snippet } or null if the message is not a reply.
 */
function buildReplyContext(message, customerHp) {
  const ctx = extractContextInfo(message);
  if (!ctx) return null;

  const quoted = ctx.quotedMessage;
  let snippet = extractMessageText(quoted);
  if (!snippet || !snippet.trim()) {
    if (quoted.productMessage?.product?.title) snippet = `Produk: ${quoted.productMessage.product.title}`;
    else if (extractImageMessage(quoted)) snippet = '[Gambar]';
    else if (quoted.videoMessage) snippet = '[Video]';
    else if (quoted.audioMessage) snippet = '[Pesan suara]';
    else if (quoted.documentMessage) snippet = `[Dokumen] ${quoted.documentMessage.fileName || ''}`.trim();
    else if (quoted.stickerMessage) snippet = '[Stiker]';
    else snippet = '[Pesan]';
  }
  snippet = snippet.trim().slice(0, 300);

  // Determine who wrote the quoted message by comparing the participant JID with the customer's number
  let sender = null;
  if (ctx.participant) {
    let participantJid = ctx.participant;
    if (participantJid.endsWith('@lid')) {
      const mapped = lidToPhoneMap.get(normalizePhoneNumber(participantJid));
      if (mapped) participantJid = mapped + '@s.whatsapp.net';
    }
    const participantHp = normalizePhoneNumber(participantJid);
    if (participantHp) {
      sender = participantHp === customerHp ? 'customer' : 'admin';
    }
  }

  return {
    reply_to_wa_id: ctx.stanzaId || null,
    reply_to_sender: sender,
    reply_to_snippet: snippet
  };
}

const CHAT_MEDIA_DIR = path.join('uploads', 'chat-media');

/**
 * Downloads an incoming image, compresses it (max 1280px, JPEG q70) to keep storage small,
 * and writes it to uploads/chat-media. Returns { media_type, media_path, media_mime } or null on failure.
 */
async function downloadAndCompressImage(sock, msg, messageId) {
  try {
    const buffer = await downloadMediaMessage(
      msg,
      'buffer',
      {},
      {
        logger: pino({ level: 'silent' }),
        reuploadRequest: sock.updateMediaMessage
      }
    );
    if (!buffer || buffer.length === 0) return null;

    const compressed = await sharp(buffer)
      .rotate() // respect EXIF orientation
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70, mozjpeg: true })
      .toBuffer();

    fs.mkdirSync(CHAT_MEDIA_DIR, { recursive: true });
    const safeId = String(messageId || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = path.join(CHAT_MEDIA_DIR, `${safeId}.jpg`);
    fs.writeFileSync(filePath, compressed);

    console.log(`[Media] Saved compressed image for message ${messageId}: ${filePath} (${(buffer.length / 1024).toFixed(0)}KB -> ${(compressed.length / 1024).toFixed(0)}KB)`);
    // Store with forward slashes so the path works as a URL on the dashboard
    return {
      media_type: 'image',
      media_path: filePath.split(path.sep).join('/'),
      media_mime: 'image/jpeg'
    };
  } catch (err) {
    console.error(`[Media] Failed to download/compress image for message ${messageId}:`, err.message);
    return null;
  }
}


/**
 * Handles incoming/outgoing messages tracked by Baileys.
 */
export async function handleIncomingMessage(sock, msg, adminId, isHistorySync = false) {
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

  // 0.1 Check if message already exists (prevent duplicate processing from history sync)
  const messageId = msg.key?.id;
  if (messageId) {
    const existingMsg = await prisma.chatMessage.findUnique({
      where: { wa_message_id: messageId }
    });
    if (existingMsg) {
      return;
    }
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
  
  const rawText = extractMessageText(msg.message);
  const catalogContext = extractCatalogContext(msg.message);
  const imageMessage = extractImageMessage(msg.message);
  let text = rawText;
  if (catalogContext) {
    // Include the business catalog context so the AI classifier knows which product/order is being discussed
    text = rawText && rawText.trim() ? `${rawText.trim()}\n${catalogContext}` : catalogContext;
  }
  if ((!text || !text.trim()) && imageMessage) {
    text = '[Gambar]'; // Image without caption still gets tracked
  }
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

  if (customer && customer.is_ignored) {
    console.log(`[Message Ignore] Received message from ignored contact ${customerHp}. Skipping.`);
    return;
  }

  if (!customer) {
    // Try to get contact name from Baileys contacts cache first
    const socketContact = sock.contacts?.[remoteJid];
    let contactName = socketContact?.name || socketContact?.verifiedName || socketContact?.notify || null;

    // Fallback to pushName or verifiedBizName if message is from the customer
    if (!contactName && !fromMe) {
      contactName = msg.pushName || msg.verifiedBizName || null;
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
    const incomingPushName = msg.pushName || msg.verifiedBizName;
    if (!fromMe && incomingPushName) {
      const allAdmins = await prisma.admin.findMany({ select: { nama_admin: true } });
      const adminNames = allAdmins.map(a => a.nama_admin.toLowerCase());
      const currentNameLower = customer.nama_kontak?.toLowerCase();
      const currentSockName = sock.user?.name?.toLowerCase();

      const isIncorrectName = !customer.nama_kontak || 
                              currentNameLower === 'pelanggan wa' ||
                              currentNameLower === 'pelanggan' ||
                              (currentSockName && currentNameLower === currentSockName) ||
                              adminNames.includes(currentNameLower);

      if (isIncorrectName) {
        // Fetch a fresh copy from the database to see if another concurrent thread has already updated it
        const freshCustomer = await prisma.customer.findUnique({ where: { id: customer.id } });
        if (freshCustomer) {
          const freshNameLower = freshCustomer.nama_kontak?.toLowerCase();
          const stillIncorrect = !freshCustomer.nama_kontak ||
                                 freshNameLower === 'pelanggan wa' ||
                                 freshNameLower === 'pelanggan' ||
                                 (currentSockName && freshNameLower === currentSockName) ||
                                 adminNames.includes(freshNameLower);
          
          if (stillIncorrect) {
            try {
              customer = await prisma.customer.update({
                where: { id: customer.id },
                data: { nama_kontak: incomingPushName }
              });
            } catch (updateErr) {
              console.warn(`[Concurrency Warning] Failed to update customer name due to lock/concurrency:`, updateErr.message);
              customer = await prisma.customer.findUnique({ where: { id: customer.id } }) || customer;
            }
          } else {
            customer = freshCustomer;
          }
        }
      }
    }
  }

  // 4. Pengecekan Lead — one customer has exactly one lead, so always reuse it
  let lead = await prisma.lead.findUnique({ where: { customer_id: customer.id } });

  // Reopen it if it was previously closed — there's no separate lead to fall back to
  if (lead && (lead.status_lead === 'CLOSED WON' || lead.status_lead === 'CLOSED LOST')) {
    try {
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: { status_lead: 'QUALIFIED', closed_at: null }
      });
      console.log(`[Lead Reopen] Reopened closed lead ${lead.kode_lead} for customer ${customerHp}`);
    } catch (reopenErr) {
      console.error(`[Lead Reopen] Failed to reopen lead ${lead.kode_lead}:`, reopenErr);
    }
  }

  // 5. Buat Lead Baru if this customer has never had one
  if (!lead) {
    try {
      const kode_lead = await generateKodeLead(admin.id);
      // Classify referral source from the customer's opening greeting (rules stored in DB, cached in memory)
      const greetingSource = pengirim === 'customer' ? await detectReferralSourceFromGreeting(rawText) : null;
      lead = await prisma.lead.create({
        data: {
          kode_lead,
          customer_id: customer.id,
          admin_id: admin.id,
          status_lead: 'NEW',
          ...(greetingSource ? { referral_source: greetingSource } : {})
        }
      });
      console.log(`Created new active lead ${kode_lead} for customer ${customerHp}${greetingSource ? ` (referral: ${greetingSource} via greeting)` : ''}`);
    } catch (leadErr) {
      // If lead creation fails due to a race condition, another request already created it
      if (leadErr.code === 'P2002') {
        lead = await prisma.lead.findUnique({ where: { customer_id: customer.id } });
      }
      if (!lead) throw leadErr;
    }
  }

  // 6. Simpan Pesan to ChatMessage
  let timestampSec = msg.messageTimestamp;
  if (timestampSec && typeof timestampSec === 'object' && typeof timestampSec.toNumber === 'function') {
    timestampSec = timestampSec.toNumber();
  } else if (timestampSec) {
    timestampSec = Number(timestampSec);
  }

  const waktu_pesan = (timestampSec && !isNaN(timestampSec))
    ? new Date(timestampSec * 1000) 
    : new Date();

  // Download & compress image attachments (e.g. payment proofs) so the AI worker can analyze them later
  let media = null;
  if (imageMessage && !isHistorySync) {
    media = await downloadAndCompressImage(sock, msg, messageId);
  }

  // Capture WhatsApp reply (quote) context so the dashboard can render it like WhatsApp
  const replyContext = buildReplyContext(msg.message, customerHp);

  try {
    // 1. Create chat message
    await prisma.chatMessage.create({
      data: {
        wa_message_id: messageId,
        lead_id: lead.id,
        pengirim,
        pesan: text,
        waktu_pesan,
        ...(media ? media : {}),
        ...(replyContext ? replyContext : {})
      }
    });

    // 2. Update Lead's timestamps (use updateMany to avoid P2025 errors if the record is not matched)
    await prisma.lead.updateMany({
      where: {
        id: lead.id,
        ...(isHistorySync ? {
          OR: [
            { last_activity_at: null },
            { last_activity_at: { lt: waktu_pesan } }
          ]
        } : {})
      },
      data: { 
        updatedAt: isHistorySync ? waktu_pesan : new Date(),
        last_activity_at: isHistorySync ? waktu_pesan : new Date()
      }
    });

    console.log(`[${pengirim}] saved for Lead ID ${lead.id}: "${text.slice(0, 30)}..."`);
  } catch (err) {
    if (err.code === 'P2002' && (err.meta?.target?.includes('wa_message_id') || err.meta?.modelName === 'ChatMessage')) {
      console.log(`[WhatsApp Event] Message ${messageId} already exists (handled concurrently). Skipping insert.`);
      return;
    }
    throw err;
  }
  
  // Enqueue AI kualifikasi job with a 15-minute debounce (only if not history sync)
  if (!isHistorySync) {
    await enqueueAIJob(lead.id);
  }
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
      if (existingCustomer.nama_kontak !== contactName) {
        try {
          await prisma.customer.update({
            where: { id: existingCustomer.id },
            data: { nama_kontak: contactName }
          });
          console.log(`[Contacts Sync] Updated name for HP ${customerHp}: "${contactName}"`);
        } catch (updateErr) {
          console.warn(`[Contacts Sync Warning] Failed to update name for ${customerHp} due to concurrency:`, updateErr.message);
        }
      }
    }
  } catch (err) {
    console.error(`Failed to update customer from contact sync event:`, err);
  }
}

/**
 * Updates an existing customer's name from a Baileys chat object (always synchronized on reconnect).
 * 
 * @param {object} chat 
 */
async function updateCustomerNameFromChat(chat) {
  try {
    let jid = chat.id;
    if (!jid || (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid'))) {
      return;
    }

    // Translate LID to Phone Number JID if mapping exists
    if (jid.endsWith('@lid')) {
      const cleanLid = normalizePhoneNumber(jid);
      const mappedPhone = lidToPhoneMap.get(cleanLid);
      if (mappedPhone) {
        jid = mappedPhone + '@s.whatsapp.net';
      }
    }

    const customerHp = normalizePhoneNumber(jid);
    if (!customerHp) return;

    const contactName = chat.name;
    if (!contactName) return;

    // Fetch active admins to filter out admin numbers/names
    const admins = await prisma.admin.findMany({ select: { nama_admin: true } });
    const adminNames = admins.map(a => a.nama_admin.toLowerCase());
    
    // Ignore updates that match admin names
    if (adminNames.includes(contactName.toLowerCase())) return;

    const existingCustomer = await prisma.customer.findUnique({
      where: { nomor_hp: customerHp }
    });

    if (existingCustomer && existingCustomer.nama_kontak !== contactName) {
      try {
        await prisma.customer.update({
          where: { id: existingCustomer.id },
          data: { nama_kontak: contactName }
        });
        console.log(`[Chats Sync] Updated name for HP ${customerHp}: "${contactName}"`);
      } catch (updateErr) {
        console.warn(`[Chats Sync Warning] Failed to update name for ${customerHp} due to concurrency:`, updateErr.message);
      }
    }
  } catch (err) {
    console.error(`[Chats Sync] Failed to update customer from chat event:`, err);
  }
}

/**
 * Generates a unique sequential Lead Code based on the pattern:
 * YYMM[AdminInitial][Index3Digit] (e.g. 2607E001)
 * The index resets back to 001 every month.
 * 
 * @param {number} adminId 
 * @returns {Promise<string>}
 */
export async function generateKodeLead(adminId) {
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  const adminInitial = admin?.nama_admin?.trim().charAt(0).toUpperCase() || 'X';
  
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `${yy}${mm}`;
  
  // Find all leads created in this month
  const monthlyLeads = await prisma.lead.findMany({
    where: {
      kode_lead: {
        startsWith: prefix
      }
    },
    select: {
      kode_lead: true
    }
  });
  
  let maxIndex = 0;
  for (const l of monthlyLeads) {
    // Extract the index part (last 3 characters)
    const indexPart = l.kode_lead.slice(-3);
    const indexNum = parseInt(indexPart, 10);
    if (!isNaN(indexNum) && indexNum > maxIndex) {
      maxIndex = indexNum;
    }
  }
  
  const nextIndex = maxIndex + 1;
  const indexStr = nextIndex.toString().padStart(3, '0');
  return `${prefix}${adminInitial}${indexStr}`;
}

/**
 * Logout and clear WhatsApp session for an Admin.
 * 
 * @param {number} adminId 
 */
export async function logoutAdminSession(adminId) {
  const sock = activeSockets.get(adminId);
  if (sock) {
    try {
      sock.isManualShutdown = true;
      await sock.logout();
    } catch (err) {
      console.error(`Error logging out Baileys socket for Admin ${adminId}:`, err.message);
      try {
        sock.end();
      } catch (_) {}
    }
    activeSockets.delete(adminId);
  }
  activeQrs.delete(adminId);

  // Clean up database session records
  try {
    if (prisma.whatsAppSession) {
      await prisma.whatsAppSession.deleteMany({
        where: { admin_id: adminId }
      });
    } else {
      await prisma.$executeRawUnsafe(
        'DELETE FROM WhatsAppSession WHERE admin_id = ?',
        adminId
      );
    }
    console.log(`[Logout] Successfully deleted database session records for Admin ID: ${adminId}`);
  } catch (err) {
    console.error(`[Logout] Failed to delete database session records:`, err.message);
  }
}


