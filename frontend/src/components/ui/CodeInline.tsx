import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

// ============================================================================
// CodeInline — monospace inline code chip. Ported from CodeInline.dc.html.
// ============================================================================

export interface CodeInlineProps {
  text?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function CodeInline({ text, children, className }: CodeInlineProps) {
  return (
    <code
      className={cn(
        'whitespace-nowrap rounded-md border border-line-strong bg-code-bg px-[7px] py-0.5 font-mono text-[12.5px] text-code-fg',
        className,
      )}
    >
      {children ?? text}
    </code>
  );
}
