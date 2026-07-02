import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/Icon';

// ============================================================================
// ImageLightbox — full-screen overlay for viewing a chat image at full size.
// Closes on Escape or backdrop click; locks body scroll while open; offers an
// "open in new tab" shortcut. Rendered through a portal (mirrors Modal).
// ============================================================================

export interface ImageLightboxProps {
  url: string;
  alt?: string;
  onClose: () => void;
}

export function ImageLightbox({ url, alt = 'attachment', onClose }: ImageLightboxProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(6,10,8,0.85)] p-4 backdrop-blur-[2px] animate-wm-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Open in new tab"
        >
          <Icon name="externalLink" size={18} />
        </a>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Close"
        >
          <Icon name="x" size={20} />
        </button>
      </div>
      <img
        src={url}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-[6px] object-contain shadow-wm-pop animate-wm-scale-in"
      />
    </div>,
    document.body,
  );
}
