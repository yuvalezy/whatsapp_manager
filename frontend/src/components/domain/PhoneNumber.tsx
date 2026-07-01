import { cn } from '@/lib/cn';
import { formatPhone } from '@/lib/format';

// ============================================================================
// PhoneNumber — renders a normalized number in monospace, human-formatted.
// Ported from PhoneNumber.dc.html.
// ============================================================================

export interface PhoneNumberProps {
  value: string | null | undefined;
  fontSize?: string;
  className?: string;
}

export function PhoneNumber({ value, fontSize = '13.5px', className }: PhoneNumberProps) {
  return (
    <span
      className={cn('font-mono tracking-[0.01em] text-fg', className)}
      style={{ fontSize }}
    >
      {formatPhone(value) || '—'}
    </span>
  );
}
