import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';

// ============================================================================
// Select — native select styled to match the kit, with a chevron affordance,
// label, and error state. Ported from Select.dc.html.
// Every option must carry a non-empty `value`. Controlled via onChange(value).
// ============================================================================

export interface SelectOption {
  value: string;
  label: ReactNode;
}

export interface SelectProps {
  label?: ReactNode;
  value?: string;
  options: SelectOption[];
  disabled?: boolean;
  error?: string;
  onChange?: (value: string) => void;
  className?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
}

export function Select({
  label,
  value,
  options,
  disabled = false,
  error,
  onChange,
  className,
  id,
  name,
  'aria-label': ariaLabel,
}: SelectProps) {
  const reactId = useId();
  const controlId = id ?? reactId;
  const hasError = !!error;
  const resolvedValue = value ?? options[0]?.value ?? '';

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label != null && (
        <label htmlFor={controlId} className="text-[12.5px] font-semibold text-fg-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={controlId}
          name={name}
          aria-label={ariaLabel}
          value={resolvedValue}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn(
            'w-full appearance-none rounded-wm-sm border bg-surface py-[9px] pl-3 pr-8 text-[13.5px] text-fg outline-none transition-[border-color,box-shadow] duration-150',
            hasError ? 'border-danger' : 'border-line-strong',
            'focus:border-primary focus:shadow-[0_0_0_3px_var(--wm-primary-soft)]',
            disabled ? 'cursor-not-allowed bg-surface-2 opacity-60' : 'cursor-pointer',
          )}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {typeof opt.label === 'string' ? opt.label : opt.value}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-[11px] top-1/2 flex -translate-y-1/2 text-fg-muted">
          <Icon name="chevronDown" size={14} />
        </span>
      </div>
      {hasError && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
