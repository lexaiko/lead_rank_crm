import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { ChatMessage } from '../types';
import { X, ExternalLink, ZoomIn, Reply } from 'lucide-react';

interface VirtualChatListProps {
  messages: ChatMessage[];
  onReplyMessage?: (message: ChatMessage) => void;
}

export const VirtualChatList: React.FC<VirtualChatListProps> = ({ messages, onReplyMessage }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [highlightedWaId, setHighlightedWaId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Sort messages strictly chronologically by message timestamp (waktu_pesan), fallback to database ID if timestamps match
  const sortedMessages = useMemo(() => {
    return messages.slice().sort((a, b) => {
      const timeA = new Date(a.waktu_pesan || a.createdAt).getTime();
      const timeB = new Date(b.waktu_pesan || b.createdAt).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return (a.id || 0) - (b.id || 0);
    });
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive or update
  useEffect(() => {
    if (parentRef.current) {
      parentRef.current.scrollTop = parentRef.current.scrollHeight;
    }
  }, [sortedMessages.length, sortedMessages]);

  useEffect(() => () => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
  }, []);

  // Index messages by their WhatsApp ID so reply quotes can locate the original message
  const byWaId = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const m of sortedMessages) {
      if (m.wa_message_id) map.set(m.wa_message_id, m);
    }
    return map;
  }, [sortedMessages]);

  const scrollToQuoted = useCallback((waId?: string | null) => {
    if (!waId) return;
    const el = messageRefs.current[waId];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedWaId(waId);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedWaId(null), 1600);
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  // Helper to check if date has changed between items to show date header
  const shouldShowDateHeader = (index: number) => {
    if (index === 0) return true;
    const current = new Date(sortedMessages[index].waktu_pesan).toDateString();
    const prev = new Date(sortedMessages[index - 1].waktu_pesan).toDateString();
    return current !== prev;
  };

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-y-auto px-3 sm:px-4 py-6 bg-chat-bg border border-border/50 rounded-2xl relative flex flex-col gap-1"
    >
      {sortedMessages.length === 0 ? (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
          Belum ada riwayat chat untuk lead ini.
        </div>
      ) : (
        <div className="flex flex-col w-full gap-1">
          {sortedMessages.map((message, index) => {
            const isAdmin = message.pengirim === 'admin';
            const showDateHeader = shouldShowDateHeader(index);
            const hasImage = message.media_type === 'image' && !!message.media_path;
            const hideText = hasImage && message.pesan === '[Gambar]';
            const isHighlighted = !!message.wa_message_id && highlightedWaId === message.wa_message_id;

            // Reply (quote) context — resolve the original message when it's loaded in this chat
            const hasReply = !!message.reply_to_snippet;
            const quotedOriginal = message.reply_to_wa_id ? byWaId.get(message.reply_to_wa_id) : undefined;
            const quotedSender = quotedOriginal?.pengirim || message.reply_to_sender || null;
            const quotedLabel = quotedSender === 'admin' ? 'Admin' : quotedSender === 'customer' ? 'Customer' : 'Pesan';
            const quotedThumb = quotedOriginal?.media_type === 'image' && quotedOriginal.media_path
              ? `/${quotedOriginal.media_path}`
              : null;

            return (
              <div
                key={message.id || index}
                ref={(el) => {
                  if (message.wa_message_id) messageRefs.current[message.wa_message_id] = el;
                }}
                className="flex flex-col w-full"
              >
                {/* Date Header Separator */}
                {showDateHeader && (
                  <div className="flex justify-center my-3">
                    <span className="text-[10px] font-bold text-muted-foreground bg-secondary/80 border border-border px-3 py-1 rounded-full uppercase tracking-wider">
                      {formatDate(message.waktu_pesan)}
                    </span>
                  </div>
                )}

                {/* Message Bubble Container */}
                <div className={`flex w-full ${isAdmin ? 'justify-end' : 'justify-start'} my-1 group/bubble`}>
                  <div className={`flex items-center gap-1.5 max-w-[85%] sm:max-w-[75%] ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`flex flex-col gap-0.5 ${isAdmin ? 'items-end' : 'items-start'} min-w-0`}>
                      <div
                        onDoubleClick={() => onReplyMessage?.(message)}
                        className={`relative ${hasImage || hasReply ? 'p-1.5' : 'px-4 py-3'} rounded-2xl text-sm leading-relaxed shadow-xs font-normal break-words whitespace-pre-wrap transition-shadow duration-300 ${
                          isAdmin
                            ? 'bg-teal-600 dark:bg-teal-700 text-white rounded-tr-none'
                            : 'bg-card text-foreground border border-border/80 rounded-tl-none'
                        } ${isHighlighted ? 'ring-2 ring-amber-400' : ''}`}
                      >
                        {/* WhatsApp-style quoted reply block */}
                        {hasReply && (
                          <button
                            type="button"
                            onClick={() => scrollToQuoted(message.reply_to_wa_id)}
                            className={`w-full text-left flex items-stretch gap-2 mb-1 rounded-xl overflow-hidden border-l-4 ${
                              isAdmin
                                ? 'bg-black/20 border-amber-300'
                                : 'bg-secondary/80 border-teal-500'
                            } ${quotedOriginal ? 'cursor-pointer active:opacity-80' : 'cursor-default'}`}
                          >
                            <div className="flex-1 min-w-0 px-2.5 py-1.5">
                              <span className={`block text-[10px] font-bold ${
                                isAdmin ? 'text-amber-200' : 'text-teal-600 dark:text-teal-400'
                              }`}>
                                {quotedLabel}
                              </span>
                              <span className={`block text-xs leading-snug break-words line-clamp-2 ${
                                isAdmin ? 'text-white/85' : 'text-muted-foreground'
                              }`}>
                                {message.reply_to_snippet}
                              </span>
                            </div>
                            {quotedThumb && (
                              <img
                                src={quotedThumb}
                                alt="Kutipan gambar"
                                loading="lazy"
                                className="w-12 h-full min-h-12 object-cover shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewImage(quotedThumb);
                                }}
                              />
                            )}
                          </button>
                        )}

                        {hasImage && (
                          <div
                            onClick={() => setPreviewImage(`/${message.media_path}`)}
                            className="relative group cursor-pointer overflow-hidden rounded-xl"
                          >
                            <img
                              src={`/${message.media_path}`}
                              alt="Lampiran gambar"
                              loading="lazy"
                              className="rounded-xl max-h-64 max-w-full object-contain group-hover:opacity-90 transition-opacity"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <ZoomIn size={22} />
                            </div>
                          </div>
                        )}
                        {!hideText && (
                          <div className={hasImage || hasReply ? 'px-2.5 py-1.5' : ''}>{message.pesan}</div>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground px-1 font-semibold">
                        {formatTime(message.waktu_pesan)}
                      </span>
                    </div>

                    {/* Hover Reply Action Button */}
                    {onReplyMessage && (
                      <button
                        type="button"
                        onClick={() => onReplyMessage(message)}
                        className="opacity-0 group-hover/bubble:opacity-100 transition-opacity p-1.5 rounded-full bg-card hover:bg-muted border border-border/80 text-muted-foreground hover:text-foreground shadow-2xs cursor-pointer shrink-0"
                        title="Balas pesan ini (Reply)"
                      >
                        <Reply size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image Preview Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-scale-up"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 self-end mb-1">
              <a
                href={previewImage}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-card border border-border text-foreground hover:bg-muted transition-all flex items-center gap-1.5 text-xs font-bold shadow-md"
                title="Buka Ukuran Penuh di Tab Baru"
              >
                <ExternalLink size={14} />
                <span>Buka Tab Baru</span>
              </a>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-2 rounded-xl bg-card border border-border text-foreground hover:bg-muted transition-all cursor-pointer shadow-md"
                title="Tutup"
              >
                <X size={16} />
              </button>
            </div>

            <img
              src={previewImage}
              alt="WhatsApp Media Preview"
              className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/20"
            />
          </div>
        </div>
      )}
    </div>
  );
};
