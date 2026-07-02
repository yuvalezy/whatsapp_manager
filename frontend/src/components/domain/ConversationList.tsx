import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { RelativeTime } from './RelativeTime';
import { cn } from '@/lib/cn';
import { formatPhone } from '@/lib/format';
import type { ConversationThread } from '@/types';

// ============================================================================
// ConversationList — left-column list for the Conversations page: whitelisted
// contacts + monitored groups, sorted by last message (server-side), with a
// one-line preview per thread. Groups get a small group icon + their assigned
// business partner in the preview.
// ============================================================================

export interface ConversationListProps {
  threads: ConversationThread[];
  selected: string | null;
  onSelect: (id: string) => void;
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

export function threadName(t: ConversationThread): string {
  return t.label || (t.type === 'group' ? t.id : formatPhone(t.id));
}

export function ConversationList({ threads, selected, onSelect, loading }: ConversationListProps) {
  if (loading) {
    return <div className="p-5 text-[13px] text-fg-muted">Loading…</div>;
  }
  if (threads.length === 0) {
    return <div className="p-5 text-[13px] text-fg-muted">No conversations yet.</div>;
  }
  return (
    <div className="flex flex-col">
      {threads.map((t) => {
        const name = threadName(t);
        const isSelected = selected === t.id;
        const hasUnread = t.unread > 0 && !isSelected;
        return (
          <button
            key={`${t.type}:${t.id}`}
            type="button"
            onClick={() => onSelect(t.id)}
            className={cn(
              'flex items-center gap-3 border-b border-line px-4 py-3 text-left transition-colors hover:bg-surface-2',
              isSelected && 'bg-surface-2',
            )}
          >
            <Avatar personName={name} size="md" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  {t.type === 'group' && <Icon name="users" size={13} className="shrink-0 text-fg-muted" />}
                  <span className="truncate text-[13.5px] font-bold text-fg">{name}</span>
                </span>
                {t.lastMessage && (
                  <RelativeTime timestamp={t.lastMessage.timestamp} fontSize="11px" className="shrink-0" />
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'truncate text-[12.5px]',
                    hasUnread ? 'font-semibold text-fg' : 'text-fg-secondary',
                  )}
                >
                  {t.type === 'group' && t.bp ? `${t.bp} · ` : ''}
                  {previewFor(t)}
                </span>
                {hasUnread && (
                  <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-pill bg-primary px-1.5 text-[11px] font-bold leading-none text-primary-fg">
                    {t.unread > 99 ? '99+' : t.unread}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
