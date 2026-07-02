import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { useToast } from '@/components/ui/Toast';
import { useTranslateMessage } from '@/hooks/useTranslate';
import { MessageDetail } from './MessageDetail';
import { cn } from '@/lib/cn';
import type { StoredMessage } from '@/types';

// ============================================================================
// MessageBubbleActions — the hover/keyboard action menu for one chat bubble:
// copy text, translate to English (reuses the single-message translate
// mutation), and open full details (reuses the MessageDetail drawer). Self-
// contained: owns the menu, the detail drawer, and the translate call so
// MessageBubble stays presentational.
// ============================================================================

export interface MessageBubbleActionsProps {
  message: StoredMessage;
  /** Which corner the menu anchors to — mirrors the bubble's alignment. */
  align?: 'start' | 'end';
}

export function MessageBubbleActions({ message: msg, align = 'start' }: MessageBubbleActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const translate = useTranslateMessage();

  const copyText = msg.body?.trim() || msg.transcript?.trim() || '';
  const canCopy = copyText.length > 0;
  const canTranslate = !!(msg.body?.trim() || msg.transcript?.trim());

  // Close the menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const onCopy = () => {
    setMenuOpen(false);
    navigator.clipboard
      ?.writeText(copyText)
      .then(() => toast({ tone: 'success', title: 'Copied', description: 'Message text copied.' }))
      .catch(() => toast({ tone: 'danger', title: 'Copy failed', description: 'Could not access the clipboard.' }));
  };

  const onTranslate = () => {
    setMenuOpen(false);
    translate.mutate(msg.id, {
      onError: (e) =>
        toast({
          tone: 'danger',
          title: 'Translation failed',
          description: e instanceof Error ? e.message : 'Please try again.',
        }),
    });
  };

  const onDetails = () => {
    setMenuOpen(false);
    setDetailOpen(true);
  };

  return (
    <div ref={containerRef} className="relative">
      <IconButton
        icon="moreVertical"
        size="sm"
        variant="ghost"
        ariaLabel="Message actions"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        loading={translate.isPending}
        onClick={() => setMenuOpen((o) => !o)}
        className={cn(
          'opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100',
          menuOpen && 'opacity-100',
        )}
      />
      {menuOpen && (
        <div
          role="menu"
          className={cn(
            'absolute top-full z-20 mt-1 flex min-w-[168px] flex-col gap-0.5 rounded-wm border border-line-strong bg-surface p-1 shadow-wm-pop animate-wm-scale-in',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          <MenuItem icon="copy" label="Copy text" disabled={!canCopy} onClick={onCopy} />
          <MenuItem
            icon="languages"
            label="Translate to English"
            disabled={!canTranslate}
            onClick={onTranslate}
          />
          <MenuItem icon="eye" label="Details" onClick={onDetails} />
        </div>
      )}

      <MessageDetail open={detailOpen} message={msg} onClose={() => setDetailOpen(false)} />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: IconName;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'wm-focus-ring flex items-center gap-2.5 rounded-wm-sm px-2.5 py-2 text-left text-[13px] font-medium text-fg outline-none transition-colors',
        disabled ? 'cursor-default opacity-40' : 'hover:bg-surface-2',
      )}
    >
      <Icon name={icon} size={15} className="shrink-0 text-fg-muted" />
      {label}
    </button>
  );
}
