import { useEffect, useRef } from 'react';
import { EmojiPicker as Frimousse } from 'frimousse';
import { cn } from '@/lib/cn';

// ============================================================================
// EmojiPicker — searchable, categorized emoji popover for the compose box.
// Built on frimousse (headless/unstyled — https://frimousse.liveblocks.io),
// so only the composed parts below carry visual styling; frimousse itself
// supplies the full/current emoji set, search, and virtualized list.
// Frimousse's own Emoji wrapper already does onPointerDown/preventDefault
// before firing onClick, so selecting an emoji never blurs the compose
// textarea (insertEmoji relies on its live selectionStart/selectionEnd).
// ============================================================================

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
      className="absolute bottom-full right-0 z-20 mb-1 w-72 overflow-hidden rounded-[10px] border border-line-strong bg-surface shadow-wm-pop"
    >
      <Frimousse.Root
        onEmojiSelect={(emoji) => onSelect(emoji.emoji)}
        columns={8}
        className="flex h-80 flex-col gap-2 p-2"
      >
        <Frimousse.Search className="w-full rounded-[6px] border border-line-strong bg-surface px-2.5 py-1.5 text-[13px] text-fg outline-none placeholder:text-fg-muted focus:border-primary" />
        <Frimousse.Viewport className="flex-1">
          <Frimousse.Loading className="flex h-full items-center justify-center text-[12px] text-fg-muted">
            Loading…
          </Frimousse.Loading>
          <Frimousse.Empty className="flex h-full items-center justify-center text-[12px] text-fg-muted">
            No emoji found.
          </Frimousse.Empty>
          <Frimousse.List
            components={{
              CategoryHeader: ({ category, ...props }) => (
                <div {...props} className="bg-surface py-1 text-[11px] font-semibold text-fg-muted">
                  {category.label}
                </div>
              ),
              Row: ({ children, ...props }) => (
                <div {...props} className="gap-0.5">
                  {children}
                </div>
              ),
              Emoji: ({ emoji, ...props }) => (
                <button
                  {...props}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-[6px] text-[17px] leading-none',
                    emoji.isActive && 'bg-surface-2',
                  )}
                >
                  {emoji.emoji}
                </button>
              ),
            }}
          />
        </Frimousse.Viewport>
      </Frimousse.Root>
    </div>
  );
}
