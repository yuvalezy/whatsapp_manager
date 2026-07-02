import { useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { MessageVolumeChart } from '@/components/domain/MessageVolumeChart';
import { threadName } from '@/components/domain/ConversationList';
import { useStats } from '@/hooks/useStats';
import { useThreads } from '@/hooks/useThreads';
import { formatPhone, normalizeNumber } from '@/lib/format';
import type { TopContact } from '@/types';

// ============================================================================
// InsightsPage — aggregate analytics over captured messages: KPI tiles, a
// per-day inbound/outbound volume chart, and a top-contacts bar list. Data
// comes from GET /messages/stats; contact names are resolved against the
// conversation threads.
// ============================================================================

export function InsightsPage() {
  const { data: stats, isLoading, isError, refetch } = useStats();
  const { data: threads } = useThreads();

  // Resolve a contact_number → display name using the known threads.
  const nameFor = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of threads ?? []) map.set(normalizeNumber(t.id), threadName(t));
    return (contactNumber: string) =>
      map.get(normalizeNumber(contactNumber)) || formatPhone(contactNumber) || contactNumber;
  }, [threads]);

  const empty = !isLoading && !isError && (stats?.totalMessages ?? 0) === 0;

  return (
    <>
      <PageHeader
        title="Insights"
        subtitle="Volume, media, and enrichment stats across every captured message."
      />
      <div className="flex flex-col gap-5 p-7">
        {isError ? (
          <ErrorState
            title="Couldn't load insights"
            description="Message statistics failed to load."
            onRetry={() => void refetch()}
          />
        ) : empty ? (
          <EmptyState
            icon="activity"
            title="No messages yet"
            description="Insights appear once messages have been captured from your whitelisted contacts and groups."
          />
        ) : (
          <>
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
              <StatCard label="Total messages" value={fmt(stats?.totalMessages)} icon="messageSquare" loading={isLoading} />
              <StatCard label="Received" value={fmt(stats?.inbound)} icon="inbox" loading={isLoading} />
              <StatCard label="Sent" value={fmt(stats?.outbound)} icon="send" loading={isLoading} />
              <StatCard label="With media" value={fmt(stats?.withMedia)} icon="image" loading={isLoading} />
              <StatCard label="Transcribed" value={fmt(stats?.transcribed)} icon="mic" loading={isLoading} />
              <StatCard label="Translated" value={fmt(stats?.translated)} icon="languages" loading={isLoading} />
            </div>

            <section className="flex flex-col gap-3 rounded-wm-card border border-line-strong bg-surface p-5 shadow-wm-card">
              <span className="text-[15px] font-bold text-fg">Message volume</span>
              {isLoading ? (
                <div className="py-8 text-center text-[13px] text-fg-muted">Loading…</div>
              ) : (stats?.perDay ?? []).length === 0 ? (
                <div className="py-8 text-center text-[13px] text-fg-muted">No activity in this window.</div>
              ) : (
                <MessageVolumeChart data={stats!.perDay} />
              )}
            </section>

            <section className="flex flex-col gap-3 rounded-wm-card border border-line-strong bg-surface p-5 shadow-wm-card">
              <span className="text-[15px] font-bold text-fg">Top contacts</span>
              {isLoading ? (
                <div className="py-8 text-center text-[13px] text-fg-muted">Loading…</div>
              ) : (stats?.topContacts ?? []).length === 0 ? (
                <div className="py-8 text-center text-[13px] text-fg-muted">No contacts to rank yet.</div>
              ) : (
                <TopContacts contacts={stats!.topContacts} nameFor={nameFor} />
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}

function fmt(n: number | undefined): string {
  return (n ?? 0).toLocaleString();
}

function TopContacts({
  contacts,
  nameFor,
}: {
  contacts: TopContact[];
  nameFor: (contactNumber: string) => string;
}) {
  const max = Math.max(1, ...contacts.map((c) => c.count));
  return (
    <div className="flex flex-col gap-2.5">
      {contacts.map((c) => {
        const pct = (c.count / max) * 100;
        return (
          <div key={c.contact_number} className="flex items-center gap-3">
            <span className="w-[150px] shrink-0 truncate text-[13px] font-medium text-fg" title={nameFor(c.contact_number)}>
              {nameFor(c.contact_number)}
            </span>
            <div className="h-[18px] flex-1 overflow-hidden rounded-pill bg-surface-2">
              <div className="h-full rounded-pill bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-[56px] shrink-0 text-right text-[12.5px] tabular-nums text-fg-secondary">
              {c.count.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
