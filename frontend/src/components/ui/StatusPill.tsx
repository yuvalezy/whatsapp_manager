import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { TONE_SOFT, TONE_DOT, type Tone } from '@/lib/tones';

// ============================================================================
// StatusPill — tone pill with a leading status dot that can pulse.
// Ported from StatusPill.dc.html.
// ============================================================================

export interface StatusPillProps {
  label?: ReactNode;
  children?: ReactNode;
  tone?: Tone;
  pulse?: boolean;
  className?: string;
}

export function StatusPill({
  label,
  children,
  tone = 'neutral',
  pulse = false,
  className,
}: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[7px] whitespace-nowrap rounded-pill border py-1 pl-2 pr-[10px] text-[12.5px] font-semibold',
        TONE_SOFT[tone],
        className,
      )}
    >
      <span className="relative inline-flex h-[7px] w-[7px]">
        {pulse && (
          <span
            className={cn('absolute inset-0 rounded-full opacity-60 animate-wm-pulse', TONE_DOT[tone])}
          />
        )}
        <span className={cn('inline-block h-[7px] w-[7px] rounded-full', TONE_DOT[tone])} />
      </span>
      {children ?? label}
    </span>
  );
}
