import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

// ============================================================================
// Tooltip — hover bubble around an inline trigger. Ported from Tooltip.dc.html.
// `forceOpen` keeps it visible (used in the gallery). CSS-driven show/hide.
// ============================================================================

export interface TooltipProps {
  /** Simple text trigger with a dotted underline. */
  triggerLabel?: ReactNode;
  /** Or wrap arbitrary trigger content. Takes precedence over triggerLabel. */
  children?: ReactNode;
  text: ReactNode;
  side?: 'top' | 'bottom';
  forceOpen?: boolean;
  className?: string;
}

export function Tooltip({
  triggerLabel,
  children,
  text,
  side = 'top',
  forceOpen = false,
  className,
}: TooltipProps) {
  const [hovered, setHovered] = useState(false);
  const open = forceOpen || hovered;

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children ?? (
        <span className="cursor-help text-[12.5px] text-fg-secondary underline decoration-dotted underline-offset-[3px]">
          {triggerLabel}
        </span>
      )}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-fg shadow-wm-pop transition-opacity duration-100',
          side === 'top' ? 'bottom-[130%]' : 'top-[130%]',
          open ? 'opacity-100' : 'opacity-0',
        )}
      >
        {text}
      </span>
    </span>
  );
}
