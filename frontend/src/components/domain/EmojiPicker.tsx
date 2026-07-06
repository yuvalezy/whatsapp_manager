import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

// ============================================================================
// EmojiPicker — a small popover grid of common emoji for the compose box.
// Presentational + self-contained dismissal (outside click / Escape); the
// parent only needs onSelect to insert the chosen glyph into the draft.
// ============================================================================

const EMOJI = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😉',
  '😎', '🤔', '😮', '😢', '😭', '😡', '🥳', '😴',
  '👍', '👎', '👏', '🙏', '💪', '🤝', '✌️', '👌',
  '❤️', '🔥', '🎉', '✅', '⭐', '💯', '😅', '🙄',
];

export interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full right-0 z-20 mb-1 grid w-64 grid-cols-8 gap-0.5 rounded-[10px] border border-line-strong bg-surface p-2 shadow-wm-pop"
    >
      {EMOJI.map((e) => (
        <button
          key={e}
          type="button"
          // onMouseDown (not onClick) so the textarea doesn't blur first.
          onMouseDown={(ev) => {
            ev.preventDefault();
            onSelect(e);
          }}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-[6px] text-[16px] leading-none hover:bg-surface-2',
          )}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
