import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './Icon';
import { Skeleton } from './Skeleton';

// ============================================================================
// StatCard — metric tile: uppercase label, big value, optional delta + icon.
// Delta turns green when it starts with "+", red otherwise. Ported from
// StatCard.dc.html.
// ============================================================================

export interface StatCardProps {
  label?: ReactNode;
  value?: ReactNode;
  delta?: string;
  icon?: IconName;
  loading?: boolean;
  className?: string;
}

export function StatCard({ label = 'Metric', value = '—', delta, icon, loading = false, className }: StatCardProps) {
  const deltaUp = (delta ?? '').trim().startsWith('+');
  return (
    <div
      className={cn(
        'flex min-w-[160px] flex-col gap-2.5 rounded-wm-card border border-line-strong bg-surface p-[18px] shadow-wm-card',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-semibold uppercase tracking-[0.03em] text-fg-secondary">
          {label}
        </span>
        {icon && (
          <span className="flex text-fg-muted">
            <Icon name={icon} size={15} />
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton width="70px" height="28px" />
      ) : (
        <span className="text-[28px] font-extrabold tracking-[-0.02em] text-fg">{value}</span>
      )}
      {!loading && delta && (
        <span className={cn('text-[12.5px] font-semibold', deltaUp ? 'text-success-fg' : 'text-danger-fg')}>
          {delta}
        </span>
      )}
    </div>
  );
}
