import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { StatusPill } from '@/components/ui/StatusPill';
import { HighlightText } from '@/components/ui/HighlightText';
import { MessageTypeBadge } from './MessageTypeBadge';
import { MessageBubbleActions } from './MessageBubbleActions';
import { ImageLightbox } from './ImageLightbox';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { api } from '@/lib/api';
import type { StoredMessage } from '@/types';

// ============================================================================
// MessageBubble — one WhatsApp-style chat bubble: media, body/transcript,
// translation, and a timestamp. Aligned left (inbound) or right (outbound).
// A hover/keyboard action menu (copy / translate / details) sits beside it.
// When `findTerm` is set, matching text is highlighted; the `activeMatch`
// bubble gets a ring and scrolls itself into view.
// ============================================================================

export interface MessageBubbleProps {
  message: StoredMessage;
  highlighted?: boolean;
  /** Show the author's name above inbound bubbles (for group threads). */
  showSender?: boolean;
  /** Active in-thread find term — highlights matches in body/transcript/translation. */
  findTerm?: string;
  /** This bubble is the currently-focused find match (ring + scroll-into-view). */
  activeMatch?: boolean;
  /** Sets this message as the compose bar's active quote target. */
  onReply: (message: StoredMessage) => void;
  /** The message this one quotes, when it's loaded within the current thread window. */
  quotedMessage?: StoredMessage;
}

export function MessageBubble({
  message: msg,
  highlighted = false,
  showSender = false,
  findTerm,
  activeMatch = false,
  onReply,
  quotedMessage,
}: MessageBubbleProps) {
  const isOutbound = msg.direction === 'outbound';
  const hasMediaFile = msg.media_status === 'downloaded';
  const hasBody = !!msg.body?.trim();
  const hasTranscript = !!msg.transcript?.trim();
  const hasTranslation =
    msg.translation_status === 'done' && !!(msg.translated_body || msg.transcript_translated);
  const isEmpty = !hasBody && !hasMediaFile && !hasTranscript;
  const time = new Date(msg.timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const rowRef = useRef<HTMLDivElement>(null);
  // Bring the focused find match into view when it becomes active.
  useEffect(() => {
    if (activeMatch) rowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeMatch]);

  return (
    <div
      ref={rowRef}
      className={cn(
        'group flex items-center gap-1',
        isOutbound ? 'justify-end' : 'justify-start',
        highlighted && 'border-l-[3px] border-primary pl-2',
      )}
    >
      {isOutbound && <MessageBubbleActions message={msg} align="end" onReply={onReply} />}
      <div
        className={cn(
          'flex max-w-[min(70%,480px)] flex-col gap-1.5 px-3.5 py-2.5 text-fg',
          isOutbound
            ? 'rounded-[14px] rounded-br-[4px] bg-primary-soft'
            : 'rounded-[14px] rounded-bl-[4px] border border-line-strong bg-surface-2',
          activeMatch && 'ring-2 ring-warning ring-offset-2 ring-offset-bg',
        )}
      >
        {showSender && !isOutbound && msg.sender_name && (
          <span className="text-[11.5px] font-semibold text-primary">{msg.sender_name}</span>
        )}
        {quotedMessage && <QuotedSnippet message={quotedMessage} />}
        {hasMediaFile && <BubbleMedia message={msg} />}
        {hasBody && (
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">
            <HighlightText text={msg.body ?? ''} term={findTerm} whole />
          </p>
        )}
        {(msg.message_type === 'ptt' || msg.message_type === 'audio') && (
          <TranscriptBlock msg={msg} findTerm={findTerm} />
        )}
        {isEmpty && <MessageTypeBadge messageType={msg.message_type} />}
        {hasTranslation && (
          <div className="flex items-start gap-1.5 border-t border-line-strong pt-1.5 text-[12.5px] text-fg-secondary">
            <Icon name="languages" size={13} className="mt-0.5 shrink-0 opacity-70" />
            <HighlightText
              className="whitespace-pre-wrap"
              text={msg.translated_body || msg.transcript_translated || ''}
              term={findTerm}
              whole
            />
          </div>
        )}
        <div className="flex items-center justify-end gap-1.5 text-[10.5px] text-fg-muted">
          {msg.transcription_status === 'pending' && (
            <StatusPill tone="warning" label="Transcribing…" pulse />
          )}
          <span title={formatDateTime(msg.timestamp)}>{time}</span>
          {isOutbound && <AckIndicator ack={msg.ack} />}
        </div>
      </div>
      {!isOutbound && <MessageBubbleActions message={msg} align="start" onReply={onReply} />}
    </div>
  );
}

/** The quoted-message strip shown above a bubble's own content when it's a reply. */
function QuotedSnippet({ message }: { message: StoredMessage }) {
  const text = message.body?.trim() || message.transcript?.trim() || '';
  return (
    <div className="flex flex-col gap-0.5 rounded-[6px] border-l-2 border-primary bg-surface px-2 py-1 text-[12px] text-fg-secondary">
      {message.sender_name && (
        <span className="text-[11px] font-semibold text-primary">{message.sender_name}</span>
      )}
      {text ? (
        <span className="line-clamp-2">{text}</span>
      ) : (
        <MessageTypeBadge messageType={message.message_type} />
      )}
    </div>
  );
}

/** WhatsApp delivery ticks for an outbound message (clock → ✓ → ✓✓ → blue ✓✓). */
function AckIndicator({ ack }: { ack?: number | null }) {
  if (ack === -1) {
    return <Icon name="alertCircle" size={13} className="text-danger" aria-label="Failed to send" />;
  }
  if (ack == null || ack === 0) {
    return <Icon name="clock" size={12} className="opacity-70" aria-label="Pending" />;
  }
  if (ack === 1) {
    return <Icon name="check" size={13} aria-label="Sent" />;
  }
  // 2 = delivered, ≥3 = read/played (blue).
  return (
    <Icon
      name="checkCheck"
      size={14}
      className={ack >= 3 ? 'text-info' : undefined}
      aria-label={ack >= 3 ? 'Read' : 'Delivered'}
    />
  );
}

function TranscriptBlock({ msg, findTerm }: { msg: StoredMessage; findTerm?: string }) {
  if (msg.transcript) {
    return (
      <p className="whitespace-pre-wrap text-[13px] italic leading-relaxed text-fg-secondary">
        <HighlightText text={msg.transcript} term={findTerm} whole />
      </p>
    );
  }
  if (msg.transcription_status === 'failed') {
    return <span className="text-[12px] text-danger">Transcription failed</span>;
  }
  return null;
}

function BubbleMedia({ message: msg }: { message: StoredMessage }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const url = api.mediaUrl(msg.id);
  const type = msg.media_type ?? msg.message_type;

  if (type === 'image' || type === 'sticker') {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="block overflow-hidden rounded-[10px]"
          aria-label="View image full screen"
        >
          <img
            src={url}
            alt="attachment"
            className="max-h-[280px] w-full cursor-zoom-in rounded-[10px] object-contain transition hover:opacity-95"
          />
        </button>
        {lightboxOpen && <ImageLightbox url={url} onClose={() => setLightboxOpen(false)} />}
      </>
    );
  }
  if (type === 'ptt' || type === 'audio') {
    return <audio controls src={url} className="w-[260px] max-w-full" />;
  }
  if (type === 'video') {
    return <video controls src={url} className="max-h-[280px] w-full rounded-[10px]" />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-[12.5px] text-fg hover:bg-surface-2"
    >
      <Icon name="fileText" size={16} className="shrink-0 text-fg-muted" />
      <span className="truncate">Download attachment</span>
    </a>
  );
}
