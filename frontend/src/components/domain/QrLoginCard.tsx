import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import type { ConnectionState } from '@/types';

// ============================================================================
// QrLoginCard — the linking surface. Renders per connection state: spinner
// (initializing/authenticating), QR + steps (qr_ready), success (ready),
// reconnecting (disconnected), failure with cooldown (auth_failure/error).
// Ported from QrLoginCard.dc.html.
// ============================================================================

export interface QrLoginCardProps {
  state: ConnectionState;
  qrDataUrl?: string | null;
  cooldownActive?: boolean;
  cooldownSeconds?: number;
  errorMessage?: string;
  onRetry?: () => void;
  className?: string;
}

export function QrLoginCard({
  state,
  qrDataUrl,
  cooldownActive = false,
  cooldownSeconds = 30,
  errorMessage,
  onRetry,
  className,
}: QrLoginCardProps) {
  const isSpinner = state === 'INITIALIZING' || state === 'AUTHENTICATED';
  const isQr = state === 'QR_READY';
  const isSuccess = state === 'READY';
  const isReconnecting = state === 'DISCONNECTED';
  const isFailure = state === 'AUTH_FAILURE' || state === 'ERROR';

  const spinnerMessage =
    state === 'AUTHENTICATED' ? 'Confirming on your phone…' : 'Preparing your session…';
  const failureMessage =
    errorMessage ||
    (state === 'AUTH_FAILURE'
      ? 'Authentication failed — the code may have expired.'
      : 'Something went wrong connecting to WhatsApp Web.');

  return (
    <div
      className={cn(
        'flex w-full max-w-[460px] flex-col gap-[18px] rounded-[18px] border border-line-strong bg-surface p-6 shadow-wm-card',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-base font-bold text-fg">Link WhatsApp</span>
        <ConnectionStatusBadge state={state} />
      </div>

      {isSpinner && (
        <div className="flex flex-col items-center gap-3.5 px-2.5 py-[30px]">
          <Spinner size="lg" className="text-primary" />
          <span className="text-center text-[13.5px] text-fg-secondary">{spinnerMessage}</span>
        </div>
      )}

      {isQr && (
        <div className="flex flex-wrap items-stretch gap-5">
          <div className="flex h-[148px] w-[148px] flex-shrink-0 items-center justify-center overflow-hidden rounded-wm border border-line-strong bg-surface-2">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="WhatsApp linking QR code" className="h-full w-full object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-fg-muted">
                <Icon name="qrcode" size={34} />
                <span className="font-mono text-[10.5px]">qr_code.png</span>
              </div>
            )}
          </div>
          <div className="flex min-w-[160px] flex-1 flex-col justify-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.03em] text-fg-secondary">
              On your phone
            </span>
            <ol className="m-0 flex list-decimal flex-col gap-1 pl-[18px] text-[13px] leading-normal text-fg">
              <li>Open WhatsApp → Settings</li>
              <li>Tap Linked devices</li>
              <li>Tap Link a device, then scan</li>
            </ol>
            <span className="mt-1 text-[11.5px] text-fg-muted">Refreshes automatically every 30s</span>
          </div>
        </div>
      )}

      {isSuccess && (
        <div className="flex flex-col items-center gap-3.5 px-2.5 py-[30px]">
          <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-primary-soft text-primary">
            <Icon name="check" size={22} />
          </span>
          <span className="text-center text-[13.5px] text-fg-secondary">Linked successfully</span>
        </div>
      )}

      {isReconnecting && (
        <div className="flex flex-col items-center gap-3.5 px-2.5 py-[30px]">
          <Spinner size="lg" className="text-primary" />
          <span className="text-center text-[13.5px] text-fg-secondary">
            Session dropped — reconnecting automatically
          </span>
        </div>
      )}

      {isFailure && (
        <div className="flex flex-col items-start gap-3">
          <div className="flex items-start gap-[9px]">
            <span className="mt-0.5 flex text-danger">
              <Icon name="alertCircle" size={18} />
            </span>
            <span className="text-[13.5px] leading-normal text-fg">{failureMessage}</span>
          </div>
          {cooldownActive && (
            <span className="text-xs text-fg-muted">
              Couldn't link? Try again in {cooldownSeconds}s
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon="refreshCw"
            label="Try again"
            disabled={cooldownActive}
            onClick={onRetry}
          />
        </div>
      )}
    </div>
  );
}
