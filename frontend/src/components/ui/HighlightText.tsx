import { Fragment } from 'react';
import { cn } from '@/lib/cn';

// ============================================================================
// HighlightText — renders `text` with matches of `term` wrapped in a <mark>.
// By default whitespace splits `term` into independently-highlighted tokens
// (search results view). With `whole`, the entire term is matched as one literal
// contiguous phrase — used by the in-thread find bar so its highlighting agrees
// with its whole-phrase match count. Case-insensitive; the term is regex-escaped
// so user input can't break the pattern.
// ============================================================================

export interface HighlightTextProps {
  text: string;
  /** Search term; whitespace splits it into independently-highlighted tokens. */
  term?: string | null;
  /** Match the whole term as one contiguous phrase instead of per-token. */
  whole?: boolean;
  /** Extra classes for the wrapping element. */
  className?: string;
  /** Override the <mark> styling (e.g. the active find match). */
  markClassName?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function HighlightText({ text, term, whole = false, className, markClassName }: HighlightTextProps) {
  const trimmed = (term ?? '').trim();
  const patterns = whole
    ? (trimmed ? [escapeRegExp(trimmed)] : [])
    : trimmed.split(/\s+/).filter(Boolean).map(escapeRegExp);

  if (patterns.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // Capturing group → split keeps the matched fragments as odd-indexed parts.
  const parts = text.split(new RegExp(`(${patterns.join('|')})`, 'ig'));

  return (
    <span className={className}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className={cn(
              'rounded-[3px] bg-warning-soft px-0.5 text-warning-fg',
              markClassName,
            )}
          >
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </span>
  );
}
