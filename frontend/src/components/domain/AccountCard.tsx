import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/Avatar';
import { CodeInline } from '@/components/ui/CodeInline';
import { CopyButton } from '@/components/ui/CopyButton';
import { RelativeTime } from './RelativeTime';

// ============================================================================
// AccountCard — linked account identity: avatar, pushname, connected-since, and
// the WhatsApp ID with a copy affordance. Ported from AccountCard.dc.html.
// ============================================================================

export interface AccountCardProps {
  pushname?: string | null;
  wid?: string | null;
  readyAt?: string | number | null;
  className?: string;
}

export function AccountCard({ pushname, wid, readyAt, className }: AccountCardProps) {
  const name = pushname || 'Unknown';
  const widValue = wid || '—';
  return (
    <div
      className={cn(
        'flex flex-col gap-[18px] rounded-wm-card border border-line-strong bg-surface p-5 shadow-wm-card',
        className,
      )}
    >
      <div className="flex items-center gap-3.5">
        <Avatar personName={name} size="lg" />
        <div className="flex flex-col gap-1">
          <span className="text-base font-bold text-fg">{name}</span>
          <span className="inline-flex items-center gap-1 text-[12.5px] text-fg-secondary">
            Connected {readyAt != null && <RelativeTime timestamp={readyAt} />}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 border-t border-line-strong pt-3.5">
        <span className="text-[11.5px] font-bold uppercase tracking-[0.04em] text-fg-secondary">
          WhatsApp ID
        </span>
        <div className="flex items-center gap-2">
          <CodeInline text={widValue} />
          {wid && <CopyButton value={widValue} />}
        </div>
      </div>
    </div>
  );
}
