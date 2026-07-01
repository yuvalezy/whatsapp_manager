import { PageHeader } from '@/components/layout/PageHeader';
import { QrLoginCard } from '@/components/domain/QrLoginCard';
import { AccountCard } from '@/components/domain/AccountCard';
import { ConnectionStatusBadge } from '@/components/domain/ConnectionStatusBadge';
import { useStatus } from '@/hooks/useStatus';
import { useQr } from '@/hooks/useQr';

export function ConnectionPage() {
  const { data: status } = useStatus();
  const { data: qr } = useQr();
  const state = status?.state ?? 'INITIALIZING';

  return (
    <>
      <PageHeader
        title="Connection"
        subtitle="Link this dashboard to WhatsApp Web. It is read-only — it can never send messages."
      />
      <div className="flex flex-col items-start gap-[22px] p-7">
        {state === 'READY' ? (
          <>
            <ConnectionStatusBadge state="READY" />
            <AccountCard pushname={status?.pushname} wid={status?.wid} readyAt={status?.readyAt} />
          </>
        ) : (
          <QrLoginCard
            state={state}
            qrDataUrl={qr?.dataUrl ?? undefined}
            onRetry={() => window.location.reload()}
          />
        )}
      </div>
    </>
  );
}
