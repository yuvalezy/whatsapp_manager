import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';

// ============================================================================
// ErrorState — centered danger-toned icon + title + description with an
// optional retry action. Mirrors EmptyState's layout, but signals a failed
// fetch (never render an EmptyState for an error — that reads as data loss).
// ============================================================================

export interface ErrorStateProps {
  icon?: IconName;
  title?: ReactNode;
  description?: ReactNode;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  icon = 'alertTriangle',
  title = 'Something went wrong',
  description = 'This could not be loaded. Please try again.',
  retryLabel = 'Retry',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2.5 px-6 py-12 text-center', className)}>
      <div className="mb-1 flex h-[52px] w-[52px] items-center justify-center rounded-wm border border-line-strong bg-danger-soft text-danger-fg">
        <Icon name={icon} size={26} />
      </div>
      <div className="text-[15px] font-bold text-fg">{title}</div>
      {description != null && (
        <div className="max-w-[340px] text-[13px] leading-relaxed text-fg-secondary">{description}</div>
      )}
      {onRetry && (
        <div className="mt-1.5">
          <Button variant="secondary" size="sm" icon="refreshCw" label={retryLabel} onClick={onRetry} />
        </div>
      )}
    </div>
  );
}
