import { cn } from '@/lib/cn';

// ============================================================================
// Spinner — indeterminate ring, size sm/md/lg. Inherits currentColor so it can
// sit inside buttons/pills. Ported from Spinner.dc.html.
// ============================================================================

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  /** Accessible label; defaults to "Loading". */
  label?: string;
}

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-[22px] w-[22px] border-2',
  lg: 'h-8 w-8 border-[3px]',
};

export function Spinner({ size = 'md', className, label = 'Loading' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block animate-wm-spin rounded-full border-current border-t-transparent',
        SIZE_CLASSES[size],
        className,
      )}
    />
  );
}
