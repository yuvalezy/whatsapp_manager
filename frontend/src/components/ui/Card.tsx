import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

// ============================================================================
// Card — surface container with optional header (title/subtitle + ghost action),
// body, and footer. Ported from Card.dc.html. Composable: pass `children` for
// arbitrary body content, or `bodyText` for the simple text case.
// ============================================================================

export type CardPadding = 'none' | 'sm' | 'md';

export interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  bodyText?: ReactNode;
  children?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  footerText?: ReactNode;
  padding?: CardPadding;
  className?: string;
}

const PADDING: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-[14px]',
  md: 'p-5',
};

export function Card({
  title,
  subtitle,
  bodyText,
  children,
  actionLabel,
  onAction,
  footerText,
  padding = 'md',
  className,
}: CardProps) {
  const body = children ?? (bodyText != null ? bodyText : null);
  return (
    <div
      className={cn(
        'flex flex-col gap-[14px] rounded-wm-card border border-line-strong bg-surface shadow-wm-card',
        PADDING[padding],
        className,
      )}
    >
      {title != null && (
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[15px] font-bold text-fg">{title}</div>
            {subtitle != null && (
              <div className="mt-0.5 text-[12.5px] text-fg-secondary">{subtitle}</div>
            )}
          </div>
          {actionLabel && (
            <Button variant="ghost" size="sm" label={actionLabel} onClick={onAction} />
          )}
        </div>
      )}
      {body != null && (
        <div className="text-[13.5px] leading-relaxed text-fg-secondary">{body}</div>
      )}
      {footerText != null && (
        <div className="border-t border-line-strong pt-3 text-[12.5px] text-fg-secondary">
          {footerText}
        </div>
      )}
    </div>
  );
}
