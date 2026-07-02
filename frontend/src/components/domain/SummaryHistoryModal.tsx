import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { RelativeTime } from './RelativeTime';
import { cn } from '@/lib/cn';
import { useSummaries } from '@/hooks/useSummaries';
import type { SummaryEntry } from '@/types';

// ============================================================================
// SummaryHistoryModal — master/detail list of past AI summaries for a thread.
// Left: titles + timestamps; right: the selected summary's body + metadata.
// Also used to display a freshly generated summary (pass its id as initialId).
// ============================================================================

export interface SummaryHistoryModalProps {
  open: boolean;
  number: string | null;
  /** Preselect this summary when opening (e.g. one just generated). */
  initialId?: string | number | null;
  onClose?: () => void;
}

function windowLabel(minutes: number): string {
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return `last ${h} hour${h === 1 ? '' : 's'}`;
  }
  return `last ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export function SummaryHistoryModal({ open, number, initialId, onClose }: SummaryHistoryModalProps) {
  const { data: summaries, isLoading } = useSummaries(open ? number : null);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);

  useEffect(() => {
    if (open) setSelectedId(initialId ?? null);
  }, [open, initialId]);

  const list = summaries ?? [];
  const selected: SummaryEntry | null = useMemo(() => {
    if (list.length === 0) return null;
    return list.find((s) => s.id === selectedId) ?? list[0];
  }, [list, selectedId]);

  return (
    <Modal
      open={open}
      title="Summary history"
      description="Past AI summaries for this conversation."
      size="lg"
      hideFooter
      onClose={onClose}
    >
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton width="100%" height="46px" />
          <Skeleton width="100%" height="46px" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon="sparkles"
          title="No summaries yet"
          description="Use “Summarize” to create your first summary of this conversation."
        />
      ) : (
        <div className="flex max-h-[440px] gap-4">
          <div className="flex w-[220px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-line pr-2">
            {list.map((s) => {
              const isSel = selected?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-wm border px-2.5 py-2 text-left transition-colors',
                    isSel
                      ? 'border-primary bg-primary-soft'
                      : 'border-transparent hover:border-line-strong hover:bg-surface-2',
                  )}
                >
                  <span className="line-clamp-2 text-[13px] font-semibold text-fg">{s.title}</span>
                  <RelativeTime timestamp={s.created_at} fontSize="11px" />
                </button>
              );
            })}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto">
            {selected && (
              <>
                <h3 className="text-[15px] font-bold text-fg">{selected.title}</h3>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-fg-muted">
                  <RelativeTime timestamp={selected.created_at} fontSize="11.5px" />
                  <span>· {windowLabel(selected.window_minutes)}</span>
                  <span>· {selected.message_count} message{selected.message_count === 1 ? '' : 's'}</span>
                  {selected.image_count > 0 && (
                    <span>· {selected.image_count} image{selected.image_count === 1 ? '' : 's'}</span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-fg">{selected.body}</p>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
