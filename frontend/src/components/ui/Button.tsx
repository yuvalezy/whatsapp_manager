import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './Icon';
import { Spinner } from './Spinner';

// ============================================================================
// Button — variant (primary/secondary/ghost/danger) × size (sm/md/lg),
// with loading and leading-icon states. Ported from Button.dc.html.
// ============================================================================

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label?: ReactNode;
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: IconName;
  /** Place the icon after the label instead of before. */
  iconTrailing?: boolean;
  /** Stretch to fill the container width. */
  block?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-fg border-transparent shadow-[0_1px_2px_rgba(0,0,0,0.28)] hover:bg-primary-hover',
  secondary: 'bg-surface-2 text-fg border-line-strong hover:bg-line',
  ghost: 'bg-transparent text-fg border-transparent hover:bg-surface-2',
  danger: 'bg-transparent text-danger border-danger hover:bg-danger-soft',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-[38px] px-4 text-sm gap-2',
  lg: 'h-[46px] px-[22px] text-[15px] gap-2',
};

const ICON_SIZE: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18 };

export function Button({
  label,
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconTrailing = false,
  block = false,
  disabled,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const content = children ?? label;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading}
      className={cn(
        'wm-focus-ring inline-flex select-none items-center justify-center whitespace-nowrap rounded-[10px]',
        'border font-sans font-semibold outline-none transition-[background,box-shadow] duration-150',
        'disabled:cursor-default disabled:opacity-50',
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && <Spinner size="sm" className="text-current" />}
      {!loading && icon && !iconTrailing && <Icon name={icon} size={ICON_SIZE[size]} />}
      {content != null && <span>{content}</span>}
      {!loading && icon && iconTrailing && <Icon name={icon} size={ICON_SIZE[size]} />}
    </button>
  );
}
