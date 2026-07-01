import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { MessageRow } from './MessageRow';
import type { StoredMessage } from '@/types';

// ============================================================================
// MessageList — list of MessageRow with loading + empty states. Ported from
// MessageList.dc.html. `onOpenMessage` fires with the clicked message.
// ============================================================================

export interface MessageListProps {
  rows?: StoredMessage[];
  loading?: boolean;
  onOpenMessage?: (message: StoredMessage) => void;
  className?: string;
}

export function MessageList({ rows = [], loading = false, onOpenMessage, className }: MessageListProps) {
  if (loading) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <Skeleton width="100%" height="56px" />
        <Skeleton width="100%" height="56px" />
        <Skeleton width="100%" height="56px" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={cn('rounded-wm-card border border-line-strong bg-surface', className)}>
        <EmptyState
          icon="messageSquare"
          title="No messages captured"
          description="Nothing from whitelisted numbers yet. Inbound messages will show up here as they arrive."
        />
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-wm-card border border-line-strong bg-surface', className)}>
      {rows.map((msg) => (
        <MessageRow
          key={msg.id}
          senderName={msg.sender_name}
          senderNumber={msg.sender_number}
          body={msg.body}
          messageType={msg.message_type}
          timestamp={msg.timestamp}
          onClick={() => onOpenMessage?.(msg)}
        />
      ))}
    </div>
  );
}
