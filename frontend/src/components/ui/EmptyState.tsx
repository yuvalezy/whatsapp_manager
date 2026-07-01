import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';

// ============================================================================
// EmptyState — centered icon + title + description with an optional action.
// Ported from EmptyState.dc.html.
// ============================================================================

export interface EmptyStateProps {
  icon?: IconName;
  title?: ReactNode;
  description?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon = 'search',
  title = 'Nothing here yet',
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2.5 px-6 py-12 text-center', className)}>
      <div className="mb-1 flex h-[52px] w-[52px] items-center justify-center rounded-wm border border-line-strong bg-surface-2 text-fg-muted">
        <Icon name={icon} size={26} />
      </div>
      <div className="text-[15px] font-bold text-fg">{title}</div>
      {description != null && (
        <div className="max-w-[340px] text-[13px] leading-relaxed text-fg-secondary">{description}</div>
      )}
      {actionLabel && (
        <div className="mt-1.5">
          <Button variant="secondary" size="sm" label={actionLabel} onClick={onAction} />
        </div>
      )}
    </div>
  );
}
