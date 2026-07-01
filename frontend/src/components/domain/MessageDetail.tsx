import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { CodeInline } from '@/components/ui/CodeInline';
import { CopyButton } from '@/components/ui/CopyButton';
import { PhoneNumber } from './PhoneNumber';
import { RelativeTime } from './RelativeTime';
import { MessageTypeBadge } from './MessageTypeBadge';
import type { StoredMessage } from '@/types';

// ============================================================================
// MessageDetail — right-side read-only drawer for a captured message: sender,
// type, timestamp, full body, and message/chat IDs. Ported from
// MessageDetail.dc.html. Portal + Escape + backdrop close.
// ============================================================================

export interface MessageDetailProps {
  open: boolean;
  message?: Partial<StoredMessage> | null;
  onClose?: () => void;
}

export function MessageDetail({ open, message, onClose }: MessageDetailProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const msg = message ?? {};
  const name = msg.sender_name || 'Unknown';
  const messageId = msg.message_id ?? '—';
  const chatId = msg.chat_id ?? '—';

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex justify-end bg-[rgba(6,10,8,0.6)] backdrop-blur-[2px] animate-wm-fade-in"
      onClick={() => onClose?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-[420px] max-w-full flex-col gap-[18px] overflow-auto border-l border-line-strong bg-surface p-[22px] shadow-wm-pop animate-wm-slide-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar personName={name} size="md" />
            <div className="flex flex-col gap-[3px]">
              <span className="text-[15px] font-bold text-fg">{name}</span>
              <PhoneNumber value={msg.sender_number ?? ''} fontSize="12.5px" />
            </div>
          </div>
          <IconButton icon="x" size="sm" variant="ghost" ariaLabel="Close" onClick={onClose} />
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2.5">
          <MessageTypeBadge messageType={msg.message_type ?? 'chat'} />
          <span className="text-xs font-medium text-fg-muted">Inbound · read-only capture</span>
          <div className="flex-1" />
          <RelativeTime timestamp={msg.timestamp} />
        </div>

        {/* Body */}
        <div className="min-h-[60px] whitespace-pre-wrap rounded-wm border border-line-strong bg-surface-2 p-3.5 text-[13.5px] leading-relaxed text-fg">
          {msg.body || '(no text body for this message type)'}
        </div>

        {/* IDs */}
        <div className="flex flex-wrap gap-5 border-t border-line-strong pt-3.5">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-fg-secondary">
              Message ID
            </span>
            <div className="flex items-center gap-1.5">
              <CodeInline text={messageId} />
              <CopyButton value={String(messageId)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-fg-secondary">
              Chat ID
            </span>
            <div className="flex items-center gap-1.5">
              <CodeInline text={chatId} />
              <CopyButton value={String(chatId)} />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
