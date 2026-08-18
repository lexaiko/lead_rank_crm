import { EventEmitter } from 'events';

export const sseEmitter = new EventEmitter();

// Limit max listeners to prevent memory warnings with multiple clients
sseEmitter.setMaxListeners(100);

export function broadcastChatMessage(leadId, messageData) {
  sseEmitter.emit('chatMessage', { leadId, messageData });
}

export function broadcastLeadUpdate(leadData) {
  sseEmitter.emit('leadUpdate', leadData);
}

export function broadcastWaStatus(adminId, connected) {
  sseEmitter.emit('waStatus', { adminId, connected });
}
