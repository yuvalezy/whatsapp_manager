import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';
import { formatPhone } from '@/lib/format';
import type { GroupParticipant } from '@/types';

// ============================================================================
// MentionAutocomplete — the "@" picker shown above the group compose box while
// the user is typing an @mention. Presentational only: filtering, the active
// index, and keyboard handling live in the parent (ComposeReply), which owns
// the textarea the keystrokes land on. Selecting a row (click) calls onSelect.
// ============================================================================

export interface MentionAutocompleteProps {
  /** Already-filtered candidates (parent applies the query + cap). */
  candidates: GroupParticipant[];
  /** Highlighted row (keyboard-navigated in the parent). */
  activeIndex: number;
  onSelect: (participant: GroupParticipant) => void;
  onHover: (index: number) => void;
}

export function MentionAutocomplete({
  candidates,
  activeIndex,
  onSelect,
  onHover,
}: MentionAutocompleteProps) {
  if (candidates.length === 0) return null;
  return (
    <div className="absolute bottom-full left-0 z-20 mb-1 max-h-56 w-72 overflow-y-auto rounded-[10px] border border-line-strong bg-surface py-1 shadow-lg">
      {candidates.map((p, i) => {
        const label = p.name || formatPhone(p.number);
        return (
          <button
            key={p.jid}
            type="button"
            // onMouseDown (not onClick) so the textarea doesn't blur first and
            // swallow the selection.
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(p);
            }}
            onMouseEnter={() => onHover(i)}
            className={cn(
              'flex w-full items-center gap-2 px-2.5 py-1.5 text-left',
              i === activeIndex ? 'bg-surface-2' : 'hover:bg-surface-2',
            )}
          >
            <Avatar personName={label} size="sm" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-medium text-fg">{label}</span>
              {p.name && (
                <span className="truncate text-[11px] text-fg-muted">{formatPhone(p.number)}</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
