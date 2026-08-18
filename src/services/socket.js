import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { sseEmitter } from './sse.js';
import { prisma } from '../config/prisma.js';

let ioInstance = null;

export function initSocketServer(httpServer) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket']
  });

  // Socket.IO Security & JWT Authentication Middleware
  ioInstance.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token;

      if (!token && socket.handshake.headers.cookie) {
        const rawCookie = socket.handshake.headers.cookie;
        const match = rawCookie.match(/token=([^;]+)/);
        if (match) token = match[1];
      }

      if (!token && socket.handshake.headers.authorization) {
        const authHeader = socket.handshake.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }

      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tripbwi_secret_jwt_key_2024');
        const admin = await prisma.admin.findUnique({
          where: { id: decoded.id },
          include: { role: true }
        });

        if (admin && admin.is_active) {
          socket.admin = admin;
        }
      }
      next();
    } catch (err) {
      next();
    }
  });

  ioInstance.on('connection', (socket) => {
    socket.on('join_lead', (leadId) => {
      socket.join(`lead_${leadId}`);
    });

    socket.on('leave_lead', (leadId) => {
      socket.leave(`lead_${leadId}`);
    });
  });

  // Automatically broadcast all incoming/outbound chat messages and lead updates
  sseEmitter.on('chatMessage', ({ leadId, messageData }) => {
    if (ioInstance) {
      ioInstance.emit('new_message', { lead_id: leadId, message: messageData });
      ioInstance.to(`lead_${leadId}`).emit('new_message_room', messageData);
    }
  });

  sseEmitter.on('leadUpdate', (leadData) => {
    if (ioInstance) {
      ioInstance.emit('lead_updated', leadData);
    }
  });

  sseEmitter.on('waStatus', ({ adminId, connected }) => {
    if (ioInstance) {
      ioInstance.emit('wa_status_changed', { admin_id: adminId, connected });
    }
  });

  console.log('[WebSocket] Socket.IO server initialized with JWT security & real-time events.');
  return ioInstance;
}

export function getSocketServer() {
  return ioInstance;
}

export function emitGlobalEvent(eventName, payload) {
  if (ioInstance) {
    ioInstance.emit(eventName, payload);
  }
}
