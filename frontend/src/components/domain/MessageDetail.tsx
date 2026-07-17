import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { IconButton } from '@/components/ui/IconButton';
import { CodeInline } from '@/components/ui/CodeInline';
import { Icon } from '@/components/ui/Icon';
import { CopyButton } from '@/components/ui/CopyButton';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { PhoneNumber } from './PhoneNumber';
import { RelativeTime } from './RelativeTime';
import { MessageTypeBadge } from './MessageTypeBadge';
import { api } from '@/lib/api';
import { formatBytes, extensionForMimetype } from '@/lib/format';
import { useTranslateMessage } from '@/hooks/useTranslate';
import { useToast } from '@/components/ui/Toast';
import type { StoredMessage } from '@/types';

// ============================================================================
// MessageDetail — right-side read-only drawer for a captured message: sender,
// direction, type, timestamp, body, media (image/audio/video/doc), transcript,
// and on-demand English translation. Portal + Escape + backdrop close.
// ============================================================================

export interface MessageDetailProps {
  open: boolean;
  message?: Partial<StoredMessage> | null;
  onClose?: () => void;
}

const EYEBROW = 'text-[11px] font-bold uppercase tracking-[0.04em] text-fg-secondary';

export function MessageDetail({ open, message, onClose }: MessageDetailProps) {
  const translate = useTranslateMessage();
  const { toast } = useToast();
  const drawerRef = useRef<HTMLDivElement>(null);
  // Focus trap: initial focus, Tab containment, Escape, focus restoration.
  useFocusTrap({ containerRef: drawerRef, active: open, onEscape: onClose });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const base = message ?? {};
  // Show the freshly translated row immediately after the mutation resolves.
  const view: Partial<StoredMessage> =
    translate.data && String(translate.data.id) === String(base.id) ? translate.data : base;

  const id = view.id;
  const name = view.sender_name || 'Unknown';
  const isOutbound = view.direction === 'outbound';
  const isAudio = view.message_type === 'ptt' || view.message_type === 'audio';
  const hasAnyMedia = !!view.media_status && view.media_status !== 'none';
  const hasMediaFile = view.media_status === 'downloaded' && id != null;
  const translatable =
    !!(view.body && view.body.trim()) || !!(view.transcript && view.transcript.trim());

  const onTranslate = () => {
    if (id == null) return;
    translate.mutate(id, {
      onError: (e) =>
        toast({
          tone: 'danger',
          title: 'Translation failed',
          description: e instanceof Error ? e.message : 'Please try again.',
        }),
    });
  };

  const renderMedia = () => {
    if (id == null) return null;
    const url = api.mediaUrl(id);
    const type = view.media_type ?? view.message_type;
    if (type === 'image' || type === 'sticker') {
      return (
        <img
          src={url}
          alt="attachment"
          className="max-h-[320px] w-full rounded-wm border border-line-strong bg-surface-2 object-contain"
        />
      );
    }
    if (type === 'ptt' || type === 'audio') {
      return <audio controls src={url} className="w-full" />;
    }
    if (type === 'video') {
      return (
        <video controls src={url} className="max-h-[320px] w-full rounded-wm border border-line-strong" />
      );
    }
    const filename = view.media_filename || `attachment.${extensionForMimetype(view.media_mimetype)}`;
    const sizeLabel = view.media_filesize ? formatBytes(view.media_filesize) : '';
    return (
      <a
        href={url}
        download={filename}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2.5 rounded-wm border border-line-strong bg-surface px-3 py-2.5 text-fg hover:bg-surface-2"
        title={filename}
      >
        <Icon name="download" size={20} className="shrink-0 text-fg-muted" />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[13px] font-medium">{filename}</span>
          <span className="text-[11px] text-fg-muted">
            {[sizeLabel, 'Download'].filter(Boolean).join(' · ')}
          </span>
        </span>
      </a>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex justify-end bg-[rgba(6,10,8,0.6)] backdrop-blur-[2px] animate-wm-fade-in"
      onClick={() => onClose?.()}
    >
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Message details"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-[420px] max-w-full flex-col gap-[18px] overflow-auto border-l border-line-strong bg-surface p-[22px] shadow-wm-pop animate-wm-slide-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar personName={name} size="md" />
            <div className="flex flex-col gap-[3px]">
              <span className="text-[15px] font-bold text-fg">{name}</span>
              <PhoneNumber value={view.contact_number ?? view.sender_number ?? ''} fontSize="12.5px" />
            </div>
          </div>
          <IconButton icon="x" size="sm" variant="ghost" ariaLabel="Close" onClick={onClose} />
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2.5">
          <MessageTypeBadge messageType={view.message_type ?? 'chat'} />
          <Badge tone={isOutbound ? 'neutral' : 'info'} label={isOutbound ? 'Sent' : 'Received'} />
          <div className="flex-1" />
          <RelativeTime timestamp={view.timestamp} />
        </div>

        {/* Body */}
        <div className="min-h-[60px] whitespace-pre-wrap rounded-wm border border-line-strong bg-surface-2 p-3.5 text-[13.5px] leading-relaxed text-fg">
          {view.body || '(no text body for this message type)'}
        </div>

        {/* Attachment */}
        {hasAnyMedia && (
          <div className="flex flex-col gap-2">
            <span className={EYEBROW}>Attachment</span>
            {hasMediaFile ? (
              renderMedia()
            ) : (
              <span className="text-xs text-fg-muted">Attachment unavailable ({view.media_status}).</span>
            )}
          </div>
        )}

        {/* Transcript (audio) */}
        {isAudio && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className={EYEBROW}>Transcript</span>
              {view.transcript_language && (
                <Badge tone="neutral" label={view.transcript_language} />
              )}
            </div>
            {view.transcript ? (
              <div className="whitespace-pre-wrap rounded-wm border border-line-strong bg-surface-2 p-3.5 text-[13.5px] leading-relaxed text-fg">
                {view.transcript}
              </div>
            ) : view.transcription_status === 'pending' ? (
              <StatusPill tone="warning" label="Transcribing…" pulse />
            ) : view.transcription_status === 'failed' ? (
              <StatusPill tone="danger" label="Transcription failed" />
            ) : (
              <span className="text-xs text-fg-muted">
                Transcription is off or unavailable for this message.
              </span>
            )}
          </div>
        )}

        {/* English translation (on demand) */}
        {(translatable || view.translation_status === 'done') && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className={EYEBROW}>English translation</span>
              {view.detected_language && (
                <Badge tone="neutral" icon="languages" label={`from ${view.detected_language}`} />
              )}
            </div>
            {view.translation_status === 'done' &&
            (view.translated_body || view.transcript_translated) ? (
              <div className="flex flex-col gap-2">
                {view.translated_body && (
                  <div className="whitespace-pre-wrap rounded-wm border border-line-strong bg-surface-2 p-3.5 text-[13.5px] leading-relaxed text-fg">
                    {view.translated_body}
                  </div>
                )}
                {view.transcript_translated && (
                  <div className="whitespace-pre-wrap rounded-wm border border-line-strong bg-surface-2 p-3.5 text-[13.5px] leading-relaxed text-fg">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.04em] text-fg-muted">
                      Transcript (EN)
                    </span>
                    {view.transcript_translated}
                  </div>
                )}
              </div>
            ) : (
              <Button
                variant="secondary"
                icon="languages"
                loading={translate.isPending}
                label={view.translation_status === 'failed' ? 'Retry translation' : 'Translate to English'}
                onClick={onTranslate}
              />
            )}
          </div>
        )}

        {/* IDs */}
        <div className="mt-auto flex flex-wrap gap-5 border-t border-line-strong pt-3.5">
          <div className="flex flex-col gap-1.5">
            <span className={EYEBROW}>Message ID</span>
            <div className="flex items-center gap-1.5">
              <CodeInline text={view.message_id ?? '—'} />
              <CopyButton value={String(view.message_id ?? '')} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={EYEBROW}>Chat ID</span>
            <div className="flex items-center gap-1.5">
              <CodeInline text={view.chat_id ?? '—'} />
              <CopyButton value={String(view.chat_id ?? '')} />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
