import { cn } from '@/lib/cn';
import { relativeTime, formatDateTime } from '@/lib/format';

// ============================================================================
// RelativeTime — "4m ago" with an absolute date-time tooltip. Ported from
// RelativeTime.dc.html.
// ============================================================================

export interface RelativeTimeProps {
  timestamp: string | number | Date | null | undefined;
  fontSize?: string;
  className?: string;
}

export function RelativeTime({ timestamp, fontSize = '12.5px', className }: RelativeTimeProps) {
  const iso = timestamp != null ? new Date(timestamp).toISOString() : undefined;
  return (
    <time
      dateTime={iso}
      title={formatDateTime(timestamp)}
      className={cn('cursor-default text-fg-muted', className)}
      style={{ fontSize }}
    >
      {relativeTime(timestamp)}
    </time>
  );
}
