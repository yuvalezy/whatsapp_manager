import { forwardRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';

// ============================================================================
// ThreadFindBar — compact in-thread find toolbar (WhatsApp "search in chat").
// Filters/highlights matches within the open thread with prev/next navigation.
// A native input (not the form Input) so the page can focus it on the `/` and
// Ctrl/Cmd+F shortcuts via a forwarded ref. Enter = next, Shift+Enter = prev,
// Esc = close.
// ============================================================================

export interface ThreadFindBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  matchCount: number;
  /** 0-based index of the focused match, or -1 when there are none. */
  activeIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export const ThreadFindBar = forwardRef<HTMLInputElement, ThreadFindBarProps>(
  function ThreadFindBar(
    { query, onQueryChange, matchCount, activeIndex, onPrev, onNext, onClose },
    ref,
  ) {
    const hasQuery = query.trim().length > 0;
    return (
      <div className="flex items-center gap-1 rounded-wm-sm border border-line-strong bg-surface-2 py-1 pl-2.5 pr-1">
        <Icon name="search" size={14} className="shrink-0 text-fg-muted" />
        <input
          ref={ref}
          type="text"
          value={query}
          placeholder="Find in conversation…"
          aria-label="Find in conversation"
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (e.shiftKey) onPrev();
              else onNext();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
          className="w-[180px] max-w-full bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-muted"
        />
        <span className="min-w-[42px] shrink-0 text-center text-[11.5px] tabular-nums text-fg-muted">
          {hasQuery ? `${matchCount > 0 ? activeIndex + 1 : 0}/${matchCount}` : ''}
        </span>
        <IconButton
          icon="chevronUp"
          size="sm"
          variant="ghost"
          ariaLabel="Previous match"
          disabled={matchCount === 0}
          onClick={onPrev}
        />
        <IconButton
          icon="chevronDown"
          size="sm"
          variant="ghost"
          ariaLabel="Next match"
          disabled={matchCount === 0}
          onClick={onNext}
        />
        <IconButton icon="x" size="sm" variant="ghost" ariaLabel="Close find" onClick={onClose} />
      </div>
    );
  },
);
