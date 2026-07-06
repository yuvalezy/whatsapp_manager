import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { useToast } from '@/components/ui/Toast';
import { useTranslateMessage } from '@/hooks/useTranslate';
import { MessageDetail } from './MessageDetail';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { extensionForMimetype } from '@/lib/format';
import type { StoredMessage } from '@/types';

// ============================================================================
// MessageBubbleActions — the hover/keyboard action menu for one chat bubble:
// copy text, copy image (images only, re-encoded to PNG for clipboard
// compatibility), download attachment (any downloaded media), translate to
// English (reuses the single-message translate mutation), and open full
// details (reuses the MessageDetail drawer). Self-contained: owns the menu,
// the detail drawer, and the translate call so MessageBubble stays
// presentational.
// ============================================================================

export interface MessageBubbleActionsProps {
  message: StoredMessage;
  /** Which corner the menu anchors to — mirrors the bubble's alignment. */
  align?: 'start' | 'end';
  /** Sets this message as the compose bar's active quote target. */
  onReply: (message: StoredMessage) => void;
}

export function MessageBubbleActions({
  message: msg,
  align = 'start',
  onReply: onReplyProp,
}: MessageBubbleActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const translate = useTranslateMessage();

  const copyText = msg.body?.trim() || msg.transcript?.trim() || '';
  const canCopy = copyText.length > 0;
  const canTranslate = !!(msg.body?.trim() || msg.transcript?.trim());

  const hasMedia = msg.media_status === 'downloaded';
  const mediaKind = msg.media_type ?? msg.message_type;
  const isImage = hasMedia && (mediaKind === 'image' || mediaKind === 'sticker');
  const menuItemCount = 4 + (isImage ? 1 : 0) + (hasMedia ? 1 : 0);

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

  const onDownload = () => {
    setMenuOpen(false);
    fetch(api.mediaUrl(msg.id))
      .then((res) => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then((blob) => {
        const ext = extensionForMimetype(msg.media_mimetype);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `whatsapp-${msg.id}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch((e) =>
        toast({
          tone: 'danger',
          title: 'Download failed',
          description: e instanceof Error ? e.message : 'Please try again.',
        }),
      );
  };

  const onCopyImage = () => {
    setMenuOpen(false);
    fetch(api.mediaUrl(msg.id))
      .then((res) => {
        if (!res.ok) throw new Error('Copy failed');
        return res.blob();
      })
      .then((blob) => (blob.type === 'image/png' ? blob : toPngBlob(blob)))
      .then((pngBlob) => navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]))
      .then(() => toast({ tone: 'success', title: 'Copied', description: 'Image copied to clipboard.' }))
      .catch((e) =>
        toast({
          tone: 'danger',
          title: 'Copy failed',
          description: e instanceof Error ? e.message : 'Could not copy the image.',
        }),
      );
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

  const onReply = () => {
    setMenuOpen(false);
    onReplyProp(msg);
  };

  // Flip the menu upward when it wouldn't fit below the button (e.g. the last
  // message in a thread, right above the fixed compose bar) so it never opens
  // hidden behind that bar.
  const toggleMenu = () => {
    setMenuOpen((wasOpen) => {
      const next = !wasOpen;
      if (next) {
        const rect = containerRef.current?.getBoundingClientRect();
        const estimatedHeight = menuItemCount * 38 + 8;
        setOpenUpward(!!rect && window.innerHeight - rect.bottom < estimatedHeight);
      }
      return next;
    });
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
        onClick={toggleMenu}
        className={cn(
          'opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100',
          menuOpen && 'opacity-100',
        )}
      />
      {menuOpen && (
        <div
          role="menu"
          className={cn(
            'absolute z-20 flex min-w-[168px] flex-col gap-0.5 rounded-wm border border-line-strong bg-surface p-1 shadow-wm-pop animate-wm-scale-in',
            align === 'end' ? 'right-0' : 'left-0',
            openUpward ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
        >
          <MenuItem icon="reply" label="Reply" onClick={onReply} />
          <MenuItem icon="copy" label="Copy text" disabled={!canCopy} onClick={onCopy} />
          {isImage && <MenuItem icon="image" label="Copy image" onClick={onCopyImage} />}
          {hasMedia && <MenuItem icon="download" label="Download" onClick={onDownload} />}
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

/** Re-encode any image blob to PNG — the one format every OS clipboard reliably accepts. */
function toPngBlob(blob: Blob): Promise<Blob> {
  return createImageBitmap(blob).then(
    (bitmap) =>
      new Promise<Blob>((resolve, reject) => {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        ctx.drawImage(bitmap, 0, 0);
        canvas.toBlob((out) => (out ? resolve(out) : reject(new Error('Could not convert image'))), 'image/png');
      }),
  );
}
