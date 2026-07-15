import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';
import { Button, type ButtonVariant } from './Button';
import { useFocusTrap } from '@/hooks/useFocusTrap';

// ============================================================================
// Modal — centered dialog with backdrop. Generic title/description/icon +
// primary & optional secondary action, OR arbitrary `children` for a custom
// body. Ported from Modal.dc.html. Closes on Escape and backdrop click; locks
// body scroll while open; rendered through a portal.
// ============================================================================

export type ModalSize = 'sm' | 'md' | 'lg';
export type ModalIconTone = 'neutral' | 'warning' | 'danger';

export interface ModalProps {
  open: boolean;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  icon?: IconName;
  iconTone?: ModalIconTone;
  size?: ModalSize;
  primaryLabel?: string;
  primaryVariant?: Extract<ButtonVariant, 'primary' | 'danger'>;
  primaryDisabled?: boolean;
  secondaryLabel?: string | null;
  loading?: boolean;
  /** Hide the default footer entirely (e.g. when using custom children with own actions). */
  hideFooter?: boolean;
  onPrimary?: () => void;
  onSecondary?: () => void;
  onClose?: () => void;
}

const WIDTH: Record<ModalSize, string> = {
  sm: 'w-[380px]',
  md: 'w-[460px]',
  lg: 'w-[560px]',
};

const ICON_TONE: Record<ModalIconTone, string> = {
  neutral: 'text-primary',
  warning: 'text-warning',
  danger: 'text-danger',
};

export function Modal({
  open,
  title,
  description,
  children,
  icon,
  iconTone = 'neutral',
  size = 'md',
  primaryLabel,
  primaryVariant = 'primary',
  primaryDisabled = false,
  secondaryLabel = 'Cancel',
  loading = false,
  hideFooter = false,
  onPrimary,
  onSecondary,
  onClose,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Focus trap: initial focus, Tab containment, Escape, and focus restoration
  // on close (see useFocusTrap). Scroll-lock stays in its own effect below.
  useFocusTrap({ containerRef: dialogRef, active: open, onEscape: onClose });

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const showFooter = !hideFooter && (primaryLabel != null || secondaryLabel != null);

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(6,10,8,0.6)] p-4 backdrop-blur-[2px] animate-wm-fade-in"
      onClick={() => onClose?.()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'flex max-w-[calc(100vw-32px)] flex-col gap-[14px] rounded-[18px] border border-line-strong bg-surface p-[22px] shadow-wm-pop animate-wm-scale-in',
          WIDTH[size],
        )}
      >
        {(title != null || icon) && (
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-[9px]">
              {icon && (
                <span className={cn('flex', ICON_TONE[iconTone])}>
                  <Icon name={icon} size={17} />
                </span>
              )}
              <span className="text-[16.5px] font-bold text-fg">{title}</span>
            </div>
            <IconButton icon="x" size="sm" variant="ghost" ariaLabel="Close" onClick={onClose} />
          </div>
        )}
        {description != null && (
          <div className="text-[13.5px] leading-relaxed text-fg-secondary">{description}</div>
        )}
        {children}
        {showFooter && (
          <div className="mt-1 flex justify-end gap-2.5">
            {secondaryLabel != null && (
              <Button
                variant="secondary"
                label={secondaryLabel}
                onClick={onSecondary ?? onClose}
              />
            )}
            {primaryLabel != null && (
              <Button
                variant={primaryVariant}
                label={primaryLabel}
                loading={loading}
                disabled={primaryDisabled}
                onClick={onPrimary}
              />
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
