import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './Icon';

// ============================================================================
// Input — text / tel / number field or multiline textarea, with label, hint,
// error, leading icon, and mono option. Label/hint/error live on the control
// directly (no separate FormField wrapper). Ported from Input.dc.html.
// Controlled via `value` + `onChange(nextValue)`.
// ============================================================================

interface InputBaseProps {
  label?: ReactNode;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  mono?: boolean;
  icon?: IconName;
  onChange?: (value: string) => void;
  className?: string;
  id?: string;
  name?: string;
  autoFocus?: boolean;
}

interface SingleLineProps extends InputBaseProps {
  multiline?: false;
  type?: 'text' | 'tel' | 'number' | 'search' | 'password' | 'date';
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

interface MultilineProps extends InputBaseProps {
  multiline: true;
  rows?: number;
}

export type InputProps = SingleLineProps | MultilineProps;

export function Input(props: InputProps) {
  const {
    label,
    value,
    placeholder,
    disabled,
    required,
    error,
    hint,
    mono,
    icon,
    onChange,
    className,
    id,
    name,
    autoFocus,
  } = props;
  const reactId = useId();
  const controlId = id ?? reactId;
  const hasError = !!error;

  const controlClass = cn(
    'w-full rounded-wm-sm border bg-surface text-[13.5px] leading-normal text-fg outline-none transition-[border-color,box-shadow] duration-150',
    'placeholder:text-fg-muted',
    icon ? 'py-[9px] pl-[34px] pr-3' : 'px-3 py-[9px]',
    mono ? 'font-mono' : 'font-sans',
    hasError ? 'border-danger' : 'border-line-strong',
    'focus:border-primary focus:shadow-[0_0_0_3px_var(--wm-primary-soft)]',
    'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-60',
  );

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label != null && (
        <label htmlFor={controlId} className="text-[12.5px] font-semibold text-fg-secondary">
          {label}
          {required && <span className="text-danger"> *</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span
            className={cn(
              'pointer-events-none absolute left-[11px] flex text-fg-muted',
              props.multiline ? 'top-[10px]' : 'top-1/2 -translate-y-1/2',
            )}
          >
            <Icon name={icon} size={15} />
          </span>
        )}
        {props.multiline ? (
          <textarea
            id={controlId}
            name={name}
            value={value ?? ''}
            placeholder={placeholder}
            disabled={disabled}
            rows={props.rows ?? 3}
            autoFocus={autoFocus}
            onChange={(e) => onChange?.(e.target.value)}
            className={cn(controlClass, 'resize-y')}
          />
        ) : (
          <input
            id={controlId}
            name={name}
            type={props.type ?? 'text'}
            value={value ?? ''}
            placeholder={placeholder}
            disabled={disabled}
            autoFocus={autoFocus}
            onKeyDown={props.onKeyDown}
            onChange={(e) => onChange?.(e.target.value)}
            className={cn(controlClass, 'resize-none')}
          />
        )}
      </div>
      {hasError ? (
        <span className="text-xs text-danger">{error}</span>
      ) : hint != null ? (
        <span className="text-xs text-fg-muted">{hint}</span>
      ) : null}
    </div>
  );
}
