import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';

// ============================================================================
// Checkbox — controlled checkbox with optional label. Ported from Checkbox.dc.html.
// `onChange(checked)` receives the next boolean state.
// ============================================================================

export interface CheckboxProps {
  checked?: boolean;
  disabled?: boolean;
  label?: ReactNode;
  onChange?: (checked: boolean) => void;
  className?: string;
}

export function Checkbox({ checked = false, disabled = false, label, onChange, className }: CheckboxProps) {
  return (
    <label
      className={cn(
        'inline-flex select-none items-center gap-[9px]',
        disabled ? 'cursor-default opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-100',
          checked ? 'border-primary bg-primary text-primary-fg' : 'border-line-strong bg-surface',
        )}
      >
        {checked && <Icon name="check" size={12} />}
      </span>
      {label != null && <span className="text-[13.5px] text-fg">{label}</span>}
    </label>
  );
}
