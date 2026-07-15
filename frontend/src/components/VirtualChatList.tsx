import React, { useRef, useEffect } from 'react';
import { ChatMessage } from '../types';

interface VirtualChatListProps {
  messages: ChatMessage[];
}

export const VirtualChatList: React.FC<VirtualChatListProps> = ({ messages }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (parentRef.current) {
      parentRef.current.scrollTop = parentRef.current.scrollHeight;
    }
  }, [messages.length]);

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
      className="flex-1 overflow-y-auto px-4 py-6 bg-chat-bg border border-border/50 rounded-2xl relative flex flex-col gap-1"
    >
      {messages.length === 0 ? (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
          No chat history found for this lead.
        </div>
      ) : (
        <div className="flex flex-col w-full gap-1">
          {messages.map((message, index) => {
            const isAdmin = message.pengirim === 'admin';
            const showDateHeader = shouldShowDateHeader(index);

            return (
              <div key={message.id || index} className="flex flex-col w-full">
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
                  <div className={`flex flex-col max-w-[75%] gap-0.5 ${isAdmin ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm font-normal break-words whitespace-pre-wrap ${
                        isAdmin
                          ? 'bg-teal-600 dark:bg-teal-700 text-white rounded-tr-none'
                          : 'bg-card text-foreground border border-border/80 rounded-tl-none'
                      }`}
                    >
                      {message.pesan}
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
