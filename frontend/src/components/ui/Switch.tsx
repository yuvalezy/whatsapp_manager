import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

// ============================================================================
// Switch — controlled toggle with optional trailing label. Ported from
// Switch.dc.html. `onChange(checked)` receives the next boolean state.
// ============================================================================

export interface SwitchProps {
  checked?: boolean;
  disabled?: boolean;
  label?: ReactNode;
  /** Accessible name when no visible `label` is rendered (icon-only switches). */
  ariaLabel?: string;
  onChange?: (checked: boolean) => void;
  className?: string;
}

export function Switch({ checked = false, disabled = false, label, ariaLabel, onChange, className }: SwitchProps) {
  return (
    <label
      className={cn(
        'inline-flex select-none items-center gap-[10px]',
        disabled ? 'cursor-default opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && onChange?.(!checked)}
        className={cn(
          'wm-focus-ring relative h-[22px] w-[38px] flex-shrink-0 rounded-pill outline-none transition-colors duration-150',
          checked ? 'bg-primary' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-[left] duration-150',
            checked ? 'left-[18px]' : 'left-[2px]',
          )}
        />
      </button>
      {label != null && <span className="text-[13.5px] font-medium text-fg">{label}</span>}
    </label>
  );
}
