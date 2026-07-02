import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/Avatar';
import { PhoneNumber } from './PhoneNumber';
import { RelativeTime } from './RelativeTime';
import { MessageTypeBadge } from './MessageTypeBadge';
import type { MessageType } from '@/types';

// ============================================================================
// MessageRow — one captured message: avatar, sender, number, type badge, body
// preview, time. Ported from MessageRow.dc.html. Non-text types get a synthetic
// preview label. Clickable to open the detail drawer.
// ============================================================================

const TYPE_PREVIEW: Record<string, string> = {
  image: 'Image attachment',
  video: 'Video attachment',
  audio: 'Audio clip',
  ptt: 'Voice note',
  document: 'Document attachment',
  sticker: 'Sticker',
  location: 'Shared location',
  vcard: 'Contact card',
};

export interface MessageRowProps {
  senderName?: string | null;
  senderNumber: string;
  body?: string | null;
  messageType?: MessageType;
  timestamp?: string | number | null;
  /** For audio rows, previews the transcript when available. */
  transcript?: string | null;
  onClick?: () => void;
  className?: string;
}

export function MessageRow({
  senderName,
  senderNumber,
  body,
  messageType = 'chat',
  timestamp,
  transcript,
  onClick,
  className,
}: MessageRowProps) {
  const name = senderName || 'Unknown';
  const isAudio = messageType === 'ptt' || messageType === 'audio';
  const preview =
    isAudio && transcript
      ? transcript
      : messageType === 'chat'
        ? body || ''
        : TYPE_PREVIEW[messageType] || body || '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 border-b border-line-strong px-4 py-3 text-left transition-colors duration-100 last:border-b-0 hover:bg-surface-2',
        className,
      )}
    >
      <Avatar personName={name} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-bold text-fg">{name}</span>
          <PhoneNumber value={senderNumber} fontSize="12px" />
          <MessageTypeBadge messageType={messageType} />
        </div>
        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-fg-secondary">
          {preview}
        </span>
      </div>
      <RelativeTime timestamp={timestamp} />
    </button>
  );
}
