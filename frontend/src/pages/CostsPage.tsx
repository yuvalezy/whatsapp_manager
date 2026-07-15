import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Table, type TableColumn } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { RelativeTime } from '@/components/domain/RelativeTime';
import { useCostSummary, useDailyCosts, useRecentCosts } from '@/hooks/useCosts';
import { formatUsd } from '@/lib/format';
import type { CostEntry, CostProvider, DailyCost } from '@/types';

// ============================================================================
// CostsPage — per-provider API spend (OpenAI transcription, DeepSeek
// translation): this-month + all-time KPIs, a daily trend table, and recent
// individual calls. Costs are estimates based on configurable per-unit rates
// (see .env OPENAI_TRANSCRIBE_COST_PER_MINUTE / DEEPSEEK_*_COST_PER_1M_TOKENS).
// ============================================================================

const PROVIDER_LABEL: Record<CostProvider, string> = { openai: 'OpenAI', deepseek: 'DeepSeek' };

function providerAmount(rows: { provider: CostProvider; cost_usd: number }[] | undefined, provider: CostProvider): number {
  return rows?.find((r) => r.provider === provider)?.cost_usd ?? 0;
}

export function CostsPage() {
  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
    refetch: refetchSummary,
  } = useCostSummary();
  const { data: daily, isLoading: dailyLoading, isError: dailyError, refetch: refetchDaily } = useDailyCosts(30);
  const {
    data: recent,
    isLoading: recentLoading,
    isError: recentError,
    refetch: refetchRecent,
  } = useRecentCosts(100);

  const dailyRows = buildDailyRows(daily ?? []);

  // On a summary fetch error, reserve the KPIs for an unavailable state rather
  // than formatting undefined as $0.00 (which reads as "no spend"). A
  // successful response containing zero still formats as $0.00.
  const summaryUnavailable = summaryError;
  const summaryValue = (n: number | undefined) => (summaryUnavailable ? '—' : formatUsd(n));

  const dailyColumns: TableColumn<(typeof dailyRows)[number]>[] = [
    { key: 'day', label: 'Day' },
    { key: 'openai', label: 'OpenAI', align: 'right', render: (r) => formatUsd(r.openai, true) },
    { key: 'deepseek', label: 'DeepSeek', align: 'right', render: (r) => formatUsd(r.deepseek, true) },
    { key: 'total', label: 'Total', align: 'right', render: (r) => formatUsd(r.total) },
  ];

  const recentColumns: TableColumn<CostEntry>[] = [
    { key: 'created_at', label: 'When', render: (r) => <RelativeTime timestamp={r.created_at} /> },
    {
      key: 'provider',
      label: 'Provider',
      render: (r) => (
        <Badge label={PROVIDER_LABEL[r.provider]} tone={r.provider === 'openai' ? 'info' : 'warning'} />
      ),
    },
    { key: 'operation', label: 'Operation' },
    {
      key: 'units',
      label: 'Units',
      render: (r) =>
        r.audio_seconds != null
          ? `${r.audio_seconds.toFixed(1)}s audio`
          : r.input_tokens != null
            ? `${r.input_tokens}→${r.output_tokens} tok`
            : '—',
    },
    { key: 'cost_usd', label: 'Cost', align: 'right', render: (r) => formatUsd(r.cost_usd, true) },
  ];

  return (
    <>
      <PageHeader
        title="Costs"
        subtitle="Estimated API spend for transcription (OpenAI) and translation (DeepSeek)."
      />
      <div className="flex flex-col gap-5 p-7">
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
          {summaryError ? (
            <div className="[grid-column:1/-1]">
              <ErrorState
                title="Couldn't load cost summary"
                description="The spend summary failed to load."
                onRetry={() => void refetchSummary()}
              />
            </div>
          ) : (
            <>
              <StatCard
                label="This month"
                value={summaryValue(summary?.monthlyTotal)}
                icon="dollarSign"
                loading={summaryLoading}
              />
              <StatCard
                label="OpenAI · this month"
                value={summaryValue(providerAmount(summary?.monthlyByProvider, 'openai'))}
                icon="mic"
                loading={summaryLoading}
              />
              <StatCard
                label="DeepSeek · this month"
                value={summaryValue(providerAmount(summary?.monthlyByProvider, 'deepseek'))}
                icon="languages"
                loading={summaryLoading}
              />
              <StatCard
                label="All-time total"
                value={summaryValue(summary?.allTimeTotal)}
                icon="activity"
                loading={summaryLoading}
              />
            </>
          )}
        </div>

        <span className="text-xs text-fg-muted">
          Estimates based on configured per-unit rates — verify against each provider's current
          pricing page. A rate change only affects calls recorded after the change.
        </span>

        <div className="flex flex-col gap-2.5">
          <h2 className="text-[15px] font-bold text-fg">Last 30 days</h2>
          {dailyError ? (
            <ErrorState
              title="Couldn't load daily costs"
              description="The cost trend failed to load."
              onRetry={() => void refetchDaily()}
            />
          ) : dailyLoading ? (
            <div className="p-5 text-[13px] text-fg-muted">Loading…</div>
          ) : dailyRows.length === 0 ? (
            <EmptyState icon="dollarSign" title="No costs recorded yet" description="Nothing transcribed or translated in this window." />
          ) : (
            <Table columns={dailyColumns} rows={dailyRows} rowKey={(r) => r.day} maxHeight="360px" />
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          <h2 className="text-[15px] font-bold text-fg">Recent calls</h2>
          {recentError ? (
            <ErrorState
              title="Couldn't load recent calls"
              description="Recent API calls failed to load."
              onRetry={() => void refetchRecent()}
            />
          ) : recentLoading ? (
            <div className="p-5 text-[13px] text-fg-muted">Loading…</div>
          ) : (recent ?? []).length === 0 ? (
            <EmptyState icon="dollarSign" title="No API calls yet" description="Transcription and translation calls will show up here." />
          ) : (
            <Table columns={recentColumns} rows={recent ?? []} rowKey={(r) => r.id} maxHeight="480px" />
          )}
        </div>
      </div>
    </>
  );
}

function buildDailyRows(daily: DailyCost[]) {
  const byDay = new Map<string, { day: string; openai: number; deepseek: number; total: number }>();
  for (const row of daily) {
    const entry = byDay.get(row.day) ?? { day: row.day, openai: 0, deepseek: 0, total: 0 };
    entry[row.provider] = row.cost_usd;
    entry.total += row.cost_usd;
    byDay.set(row.day, entry);
  }
  return [...byDay.values()].sort((a, b) => b.day.localeCompare(a.day));
}
