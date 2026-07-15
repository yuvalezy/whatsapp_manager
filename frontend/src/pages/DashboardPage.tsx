import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { AccountCard } from '@/components/domain/AccountCard';
import { IgnoredCountersPanel } from '@/components/domain/IgnoredCountersPanel';
import { SafetyFlags } from '@/components/domain/SafetyFlags';
import { MessageList } from '@/components/domain/MessageList';
import { MessageDetail } from '@/components/domain/MessageDetail';
import { ErrorState } from '@/components/ui/ErrorState';
import { useStatus } from '@/hooks/useStatus';
import { useMessages, useMessageCount } from '@/hooks/useMessages';
import { useCostSummary } from '@/hooks/useCosts';
import { formatUsd } from '@/lib/format';
import type { ConnectionState, StoredMessage } from '@/types';

const CONNECTION_LABELS: Record<ConnectionState, string> = {
  READY: 'Connected',
  DISCONNECTED: 'Reconnecting',
  QR_READY: 'Scan QR',
  AUTHENTICATED: 'Linking',
  INITIALIZING: 'Starting',
  AUTH_FAILURE: 'Auth failed',
  ERROR: 'Error',
};

export function DashboardPage() {
  const { data: status } = useStatus();
  const { data: messages, isLoading, isError, refetch } = useMessages({ limit: 6 });
  const {
    data: messageCount,
    isLoading: countLoading,
    isError: countError,
  } = useMessageCount();
  const { data: costSummary, isLoading: costLoading, isError: costError } = useCostSummary();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<StoredMessage | null>(null);
  const [open, setOpen] = useState(false);

  const connectionLabel = status ? CONNECTION_LABELS[status.state] : '—';

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Connection health, whitelist, and recent captures at a glance."
      />
      <div className="flex flex-col gap-5 p-7">
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
          <StatCard label="Connection" value={connectionLabel} icon="wifi" loading={!status} />
          <StatCard
            label="Whitelisted numbers"
            value={String(status?.whitelistCount ?? 0)}
            icon="shield"
            loading={!status}
          />
          <StatCard
            label="Messages captured"
            value={countError ? '—' : (messageCount?.total ?? 0).toLocaleString()}
            icon="messageSquare"
            loading={countLoading}
          />
          <StatCard
            label="Ignored (dropped)"
            value={(status?.ignoredTotal ?? 0).toLocaleString()}
            icon="filter"
            loading={!status}
          />
          <StatCard
            label="API cost this month"
            value={costError ? '—' : formatUsd(costSummary?.monthlyTotal)}
            icon="dollarSign"
            loading={costLoading && !costError}
          />
        </div>

        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
          <AccountCard pushname={status?.pushname} wid={status?.wid} readyAt={status?.readyAt} />
          <IgnoredCountersPanel counts={status?.ignored} total={status?.ignoredTotal} loading={!status} />
          <SafetyFlags outboundEnabled={status?.outboundEnabled} monitorGroups={status?.monitorGroups} />
        </div>

        <div className="flex flex-col gap-3.5 rounded-wm-card border border-line-strong bg-surface p-[18px] shadow-wm-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold text-fg">Recent messages</h2>
              <div className="mt-0.5 text-[12.5px] text-fg-secondary">
                Latest inbound captures from whitelisted numbers
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon="externalLink"
              label="View all"
              onClick={() => navigate('/messages')}
            />
          </div>
          {isError ? (
            <ErrorState
              title="Couldn't load messages"
              description="Recent captures failed to load."
              onRetry={() => void refetch()}
            />
          ) : (
            <MessageList
              rows={messages ?? []}
              loading={isLoading}
              onOpenMessage={(m) => {
                setSelected(m);
                setOpen(true);
              }}
            />
          )}
        </div>

        <MessageDetail open={open} message={selected ?? undefined} onClose={() => setOpen(false)} />
      </div>
    </>
  );
}
