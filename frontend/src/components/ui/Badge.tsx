import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { TONE_SOFT, type Tone } from '@/lib/tones';
import { Icon, type IconName } from './Icon';

// ============================================================================
// Badge — small pill label with a tone and optional leading icon.
// Ported from Badge.dc.html.
// ============================================================================

export interface BadgeProps {
  label?: ReactNode;
  children?: ReactNode;
  tone?: Tone;
  icon?: IconName;
  className?: string;
}

export function Badge({ label, children, tone = 'neutral', icon, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[5px] whitespace-nowrap rounded-pill border px-[9px] py-[3px] text-xs font-semibold leading-[1.4]',
        TONE_SOFT[tone],
        className,
      )}
    >
      {icon && <Icon name={icon} size={12} />}
      {children ?? label}
    </span>
  );
}
