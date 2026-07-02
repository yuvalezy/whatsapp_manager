import { Avatar } from '@/components/ui/Avatar';
import { RelativeTime } from './RelativeTime';
import { cn } from '@/lib/cn';
import { formatPhone } from '@/lib/format';
import type { ConversationThread } from '@/types';

// ============================================================================
// ConversationList — left-column contact list for the Conversations page.
// Sorted by last message (server-side); shows a one-line preview per contact.
// ============================================================================

export interface ConversationListProps {
  threads: ConversationThread[];
  selected: string | null;
  onSelect: (phoneNumber: string) => void;
  loading?: boolean;
}

const TYPE_PREVIEW: Record<string, string> = {
  image: '📷 Photo',
  video: '🎥 Video',
  ptt: '🎤 Voice note',
  audio: '🎵 Audio',
  document: '📄 Document',
  sticker: 'Sticker',
  location: '📍 Location',
  vcard: 'Contact card',
};

function previewFor(thread: ConversationThread): string {
  const m = thread.lastMessage;
  if (!m) return 'No messages yet';
  const prefix = m.direction === 'outbound' ? 'You: ' : '';
  const text = m.body?.trim() || m.transcript?.trim();
  return prefix + (text || TYPE_PREVIEW[m.message_type] || 'Message');
}

export function ConversationList({ threads, selected, onSelect, loading }: ConversationListProps) {
  if (loading) {
    return <div className="p-5 text-[13px] text-fg-muted">Loading…</div>;
  }
  if (threads.length === 0) {
    return <div className="p-5 text-[13px] text-fg-muted">No whitelisted contacts yet.</div>;
  }
  return (
    <div className="flex flex-col">
      {threads.map((t) => {
        const name = t.label || formatPhone(t.phone_number);
        const isSelected = selected === t.phone_number;
        return (
          <button
            key={t.phone_number}
            type="button"
            onClick={() => onSelect(t.phone_number)}
            className={cn(
              'flex items-center gap-3 border-b border-line px-4 py-3 text-left transition-colors hover:bg-surface-2',
              isSelected && 'bg-surface-2',
            )}
          >
            <Avatar personName={name} size="md" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13.5px] font-bold text-fg">{name}</span>
                {t.lastMessage && <RelativeTime timestamp={t.lastMessage.timestamp} fontSize="11px" />}
              </div>
              <span className="truncate text-[12.5px] text-fg-secondary">{previewFor(t)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
