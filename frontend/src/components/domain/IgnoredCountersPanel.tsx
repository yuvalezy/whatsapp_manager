import { cn } from '@/lib/cn';
import { CodeInline } from '@/components/ui/CodeInline';
import { Skeleton } from '@/components/ui/Skeleton';
import type { IgnoredReason } from '@/types';

// ============================================================================
// IgnoredCountersPanel — per-reason counts of dropped traffic + total. Privacy
// note: counts only, never content. Ported from IgnoredCountersPanel.dc.html.
// ============================================================================

const REASONS: IgnoredReason[] = ['not_whitelisted', 'group', 'status_broadcast'];

export interface IgnoredCountersPanelProps {
  counts?: Record<string, number>;
  total?: number;
  loading?: boolean;
  className?: string;
}

export function IgnoredCountersPanel({ counts, total, loading = false, className }: IgnoredCountersPanelProps) {
  const safeCounts = counts ?? {};
  const resolvedTotal =
    total ?? Object.values(safeCounts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div
      className={cn(
        'flex flex-col gap-3.5 rounded-wm-card border border-line-strong bg-surface p-5 shadow-wm-card',
        className,
      )}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-bold text-fg">Ignored traffic</span>
        <span className="text-xs text-fg-muted">Counts only — no content stored</span>
      </div>
      {loading ? (
        <Skeleton width="100%" height="60px" radius="10px" />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {REASONS.map((reason) => (
              <div
                key={reason}
                className="flex items-center justify-between rounded-wm-sm bg-surface-2 px-2.5 py-2"
              >
                <CodeInline text={reason} />
                <span className="font-mono text-[13px] font-semibold text-fg">
                  {(safeCounts[reason] ?? 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-line-strong pt-2.5">
            <span className="text-[12.5px] font-bold uppercase tracking-[0.03em] text-fg-secondary">
              Total ignored
            </span>
            <span className="font-mono text-[17px] font-bold text-fg">
              {resolvedTotal.toLocaleString()}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
