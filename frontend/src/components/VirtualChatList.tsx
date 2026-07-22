import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { ChatMessage } from '../types';

interface VirtualChatListProps {
  messages: ChatMessage[];
}

export const VirtualChatList: React.FC<VirtualChatListProps> = ({ messages }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [highlightedWaId, setHighlightedWaId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (parentRef.current) {
      parentRef.current.scrollTop = parentRef.current.scrollHeight;
    }
  }, [messages.length]);

  useEffect(() => () => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
  }, []);

  // Index messages by their WhatsApp ID so reply quotes can locate the original message
  const byWaId = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const m of messages) {
      if (m.wa_message_id) map.set(m.wa_message_id, m);
    }
    return map;
  }, [messages]);

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
    const current = new Date(messages[index].waktu_pesan).toDateString();
    const prev = new Date(messages[index - 1].waktu_pesan).toDateString();
    return current !== prev;
  };

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-y-auto px-3 sm:px-4 py-6 bg-chat-bg border border-border/50 rounded-2xl relative flex flex-col gap-1"
    >
      {messages.length === 0 ? (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
          Belum ada riwayat chat untuk lead ini.
        </div>
      ) : (
        <div className="flex flex-col w-full gap-1">
          {messages.map((message, index) => {
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
                <div className={`flex w-full ${isAdmin ? 'justify-end' : 'justify-start'} my-1`}>
                  <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] gap-0.5 ${isAdmin ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`${hasImage || hasReply ? 'p-1.5' : 'px-4 py-3'} rounded-2xl text-sm leading-relaxed shadow-sm font-normal break-words whitespace-pre-wrap transition-shadow duration-300 ${
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
                            />
                          )}
                        </button>
                      )}

                      {hasImage && (
                        <a href={`/${message.media_path}`} target="_blank" rel="noopener noreferrer">
                          <img
                            src={`/${message.media_path}`}
                            alt="Lampiran gambar"
                            loading="lazy"
                            className="rounded-xl max-h-64 max-w-full object-contain"
                          />
                        </a>
                      )}
                      {!hideText && (
                        <div className={hasImage || hasReply ? 'px-2.5 py-1.5' : ''}>{message.pesan}</div>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground px-1 font-semibold">
                      {formatTime(message.waktu_pesan)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
