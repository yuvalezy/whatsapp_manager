import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { StatusPill } from '@/components/ui/StatusPill';

// ============================================================================
// SafetyFlags — read-only summary of the two safety switches (outbound &
// group monitoring) with a reassuring footnote. Ported from SafetyFlags.dc.html.
// ============================================================================

export interface SafetyFlagsProps {
  outboundEnabled?: boolean;
  monitorGroups?: boolean;
  className?: string;
}

export function SafetyFlags({ outboundEnabled = false, monitorGroups = false, className }: SafetyFlagsProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3.5 rounded-wm-card border border-line-strong bg-surface p-5 shadow-wm-card',
        className,
      )}
    >
      <span className="text-[15px] font-bold text-fg">Safety</span>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[9px]">
          <Icon name="lock" size={15} className={outboundEnabled ? 'text-fg-secondary' : 'text-success-fg'} />
          <span className="text-[13.5px] font-medium text-fg-secondary">Outbound messaging</span>
        </div>
        <StatusPill
          label={outboundEnabled ? 'Enabled' : 'Disabled'}
          tone={outboundEnabled ? 'warning' : 'success'}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[9px]">
          <Icon name="users" size={15} className="text-fg-secondary" />
          <span className="text-[13.5px] font-medium text-fg-secondary">Group chats monitored</span>
        </div>
        <StatusPill label={monitorGroups ? 'On' : 'Off'} tone={monitorGroups ? 'info' : 'neutral'} />
      </div>

      <span className="border-t border-line-strong pt-2.5 text-xs leading-normal text-fg-muted">
        This dashboard only reads inbound DMs from whitelisted numbers. It never sends messages.
      </span>
    </div>
  );
}
