import { Icon } from '@/components/ui/Icon';
import { StatusPill } from '@/components/ui/StatusPill';
import { MessageTypeBadge } from './MessageTypeBadge';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { api } from '@/lib/api';
import type { StoredMessage } from '@/types';

// ============================================================================
// MessageBubble — one WhatsApp-style chat bubble: media, body/transcript,
// translation, and a timestamp. Aligned left (inbound) or right (outbound).
// ============================================================================

export interface MessageBubbleProps {
  message: StoredMessage;
  highlighted?: boolean;
  /** Show the author's name above inbound bubbles (for group threads). */
  showSender?: boolean;
}

export function MessageBubble({ message: msg, highlighted = false, showSender = false }: MessageBubbleProps) {
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

  return (
    <div className={cn('flex', isOutbound ? 'justify-end' : 'justify-start', highlighted && 'border-l-[3px] border-primary pl-2')}>
      <div
        className={cn(
          'flex max-w-[min(70%,480px)] flex-col gap-1.5 px-3.5 py-2.5 text-fg',
          isOutbound
            ? 'rounded-[14px] rounded-br-[4px] bg-primary-soft'
            : 'rounded-[14px] rounded-bl-[4px] border border-line-strong bg-surface-2',
        )}
      >
        {showSender && !isOutbound && msg.sender_name && (
          <span className="text-[11.5px] font-semibold text-primary">{msg.sender_name}</span>
        )}
        {hasMediaFile && <BubbleMedia message={msg} />}
        {hasBody && <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{msg.body}</p>}
        {(msg.message_type === 'ptt' || msg.message_type === 'audio') && (
          <TranscriptBlock msg={msg} />
        )}
        {isEmpty && <MessageTypeBadge messageType={msg.message_type} />}
        {hasTranslation && (
          <div className="flex items-start gap-1.5 border-t border-line-strong pt-1.5 text-[12.5px] text-fg-secondary">
            <Icon name="languages" size={13} className="mt-0.5 shrink-0 opacity-70" />
            <span className="whitespace-pre-wrap">
              {msg.translated_body || msg.transcript_translated}
            </span>
          </div>
        )}
        <div className="flex items-center justify-end gap-1.5 text-[10.5px] text-fg-muted">
          {msg.transcription_status === 'pending' && (
            <StatusPill tone="warning" label="Transcribing…" pulse />
          )}
          <span title={formatDateTime(msg.timestamp)}>{time}</span>
        </div>
      </div>
    </div>
  );
}

function TranscriptBlock({ msg }: { msg: StoredMessage }) {
  if (msg.transcript) {
    return (
      <p className="whitespace-pre-wrap text-[13px] italic leading-relaxed text-fg-secondary">
        {msg.transcript}
      </p>
    );
  }
  if (msg.transcription_status === 'failed') {
    return <span className="text-[12px] text-danger">Transcription failed</span>;
  }
  return null;
}

function BubbleMedia({ message: msg }: { message: StoredMessage }) {
  const url = api.mediaUrl(msg.id);
  const type = msg.media_type ?? msg.message_type;

  if (type === 'image' || type === 'sticker') {
    return (
      <img
        src={url}
        alt="attachment"
        className="max-h-[280px] w-full rounded-[10px] object-contain"
      />
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
