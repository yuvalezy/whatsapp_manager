import { PageHeader } from '@/components/layout/PageHeader';
import { QrLoginCard } from '@/components/domain/QrLoginCard';
import { AccountCard } from '@/components/domain/AccountCard';
import { ConnectionStatusBadge } from '@/components/domain/ConnectionStatusBadge';
import { ErrorState } from '@/components/ui/ErrorState';
import { useStatus } from '@/hooks/useStatus';
import { useQr } from '@/hooks/useQr';

// States whose UI depends on a QR code being available. A QR fetch failure only
// matters when the user is actually expected to scan something.
const QR_STATES = new Set(['INITIALIZING', 'QR_READY', 'AUTHENTICATED', 'DISCONNECTED']);

export function ConnectionPage() {
  const statusQ = useStatus();
  const qrQ = useQr();
  const state = statusQ.data?.state ?? 'INITIALIZING';

  return (
    <>
      <PageHeader
        title="Connection"
        subtitle="Link this dashboard to WhatsApp Web. It is read-only — it can never send messages."
      />
      <div className="flex flex-col items-start gap-[22px] p-7">
        {statusQ.isError ? (
          <ErrorState
            title="Couldn't load connection status"
            description="The WhatsApp connection status failed to load. Retrying will request it again."
            onRetry={() => void statusQ.refetch()}
          />
        ) : state === 'READY' ? (
          <>
            <ConnectionStatusBadge state="READY" />
            <AccountCard pushname={statusQ.data?.pushname} wid={statusQ.data?.wid} readyAt={statusQ.data?.readyAt} />
          </>
        ) : QR_STATES.has(state) && qrQ.isError ? (
          <ErrorState
            title="Couldn't load QR code"
            description="The linking QR code failed to load. Retrying will request a fresh one."
            onRetry={() => void qrQ.refetch()}
          />
        ) : (
          <QrLoginCard
            state={state}
            qrDataUrl={qrQ.data?.dataUrl ?? undefined}
            onRetry={() => window.location.reload()}
          />
        )}
      </div>
    </>
  );
}
