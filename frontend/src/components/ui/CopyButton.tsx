import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';

// ============================================================================
// CopyButton — copies `value` to the clipboard and flips to a "Copied" success
// state for ~1.5s. Ported from CopyButton.dc.html. Label is optional (icon-only
// when omitted).
// ============================================================================

export interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
}

export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleClick = () => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Copy ${value}`}
      className={cn(
        'wm-focus-ring inline-flex items-center gap-1.5 rounded-[7px] border border-line-strong bg-transparent text-xs font-semibold outline-none transition-colors duration-100 hover:bg-surface-2',
        label ? 'px-[10px] py-[5px]' : 'p-1.5',
        copied ? 'text-success-fg' : 'text-fg-secondary',
        className,
      )}
    >
      <Icon name={copied ? 'check' : 'copy'} size={13} />
      {label && <span>{copied ? 'Copied' : label}</span>}
    </button>
  );
}
