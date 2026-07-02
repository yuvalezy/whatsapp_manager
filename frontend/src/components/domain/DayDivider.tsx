import { dayDividerLabel } from '@/lib/format';

// ============================================================================
// DayDivider — sticky "Today" / "Yesterday" / date separator between messages
// of different calendar days in a conversation thread.
// ============================================================================

export interface DayDividerProps {
  timestamp: string | number | Date;
}

export function DayDivider({ timestamp }: DayDividerProps) {
  return (
    <div className="sticky top-1 z-10 my-1.5 flex justify-center">
      <span className="rounded-pill border border-line-strong bg-surface px-3 py-1 text-[11.5px] font-semibold text-fg-secondary shadow-wm-card">
        {dayDividerLabel(timestamp)}
      </span>
    </div>
  );
}
