import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './Icon';
import { Spinner } from './Spinner';

// ============================================================================
// IconButton — square icon-only button (tables, toolbars). variant ghost/solid/
// danger × size sm/md/lg, with loading. Ported from IconButton.dc.html.
// `ariaLabel` is required for accessibility.
// ============================================================================

export type IconButtonVariant = 'ghost' | 'solid' | 'danger';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  icon: IconName;
  ariaLabel: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  ghost: 'bg-transparent border-transparent text-fg-secondary hover:bg-surface-2',
  solid: 'bg-surface-2 border-line-strong text-fg hover:bg-line',
  danger: 'bg-transparent border-transparent text-danger hover:bg-danger-soft',
};

const SIZE_BOX: Record<IconButtonSize, string> = {
  sm: 'h-7 w-7',
  md: 'h-[34px] w-[34px]',
  lg: 'h-10 w-10',
};

const ICON_SIZE: Record<IconButtonSize, number> = { sm: 14, md: 16, lg: 18 };

export function IconButton({
  icon,
  ariaLabel,
  variant = 'ghost',
  size = 'md',
  loading = false,
  disabled,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      aria-label={ariaLabel}
      title={ariaLabel}
      disabled={isDisabled}
      className={cn(
        'wm-focus-ring inline-flex items-center justify-center rounded-wm-sm border outline-none transition-[background] duration-150',
        'disabled:cursor-default disabled:opacity-45',
        SIZE_BOX[size],
        VARIANT_CLASSES[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size="sm" className="text-current" /> : <Icon name={icon} size={ICON_SIZE[size]} />}
    </button>
  );
}
