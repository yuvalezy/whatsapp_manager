import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { StatusPill } from '@/components/ui/StatusPill';
import type { Tone } from '@/lib/tones';

// ============================================================================
// PageHeader — page title (+ optional status badge), subtitle, and an actions
// slot. Ported from PageHeader.dc.html. Pass action buttons via `actions`.
// ============================================================================

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  badgeLabel?: string;
  badgeTone?: Tone;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, badgeLabel, badgeTone = 'neutral', actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-5 border-b border-line px-7 py-6',
        className,
      )}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[22px] font-extrabold tracking-[-0.01em] text-fg">{title}</span>
          {badgeLabel && <StatusPill label={badgeLabel} tone={badgeTone} />}
        </div>
        {subtitle != null && <div className="mt-1 text-[13.5px] text-fg-secondary">{subtitle}</div>}
      </div>
      {actions != null && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}
