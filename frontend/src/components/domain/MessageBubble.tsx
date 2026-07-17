import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { StatusPill } from '@/components/ui/StatusPill';
import { HighlightText } from '@/components/ui/HighlightText';
import { MessageTypeBadge } from './MessageTypeBadge';
import { MessageBubbleActions } from './MessageBubbleActions';
import { ImageLightbox } from './ImageLightbox';
import { cn } from '@/lib/cn';
import { formatDateTime, formatPhone, formatBytes, extensionForMimetype } from '@/lib/format';
import { api } from '@/lib/api';
import type { MessageMention, MessageReaction, StoredMessage } from '@/types';

// ============================================================================
// MessageBubble — one WhatsApp-style chat bubble: media, body/transcript,
// translation, and a timestamp. Aligned left (inbound) or right (outbound).
// A hover/keyboard action menu (copy / translate / details) sits beside it.
// When `findTerm` is set, matching text is highlighted; the `activeMatch`
// bubble gets a ring and scrolls itself into view.
// ============================================================================

export interface MessageBubbleProps {
  message: StoredMessage;
  highlighted?: boolean;
  /** Show the author's name above inbound bubbles (for group threads). */
  showSender?: boolean;
  /** Active in-thread find term — highlights matches in body/transcript/translation. */
  findTerm?: string;
  /** This bubble is the currently-focused find match (ring + scroll-into-view). */
  activeMatch?: boolean;
  /** Sets this message as the compose bar's active quote target. */
  onReply: (message: StoredMessage) => void;
  /** The message this one quotes, when it's loaded within the current thread window. */
  quotedMessage?: StoredMessage;
  /** phone_number → display name, for resolving @mentions to whitelisted contacts. */
  whitelistNames?: Map<string, string>;
  /** The connected WhatsApp account's own number — an @mention of it displays as "You". */
  ownNumber?: string;
  /** Click a resolved @mention → open/whitelist that person (handled by the page). */
  onMentionClick?: (mention: MessageMention) => void;
  /** Click the quoted-reply strip → scroll to the original message (by message_id). */
  onQuoteJump?: (messageId: string) => void;
  /** Transient highlight, e.g. right after another bubble's quote jumped here. */
  flash?: boolean;
}

export function MessageBubble({
  message: msg,
  highlighted = false,
  showSender = false,
  findTerm,
  activeMatch = false,
  onReply,
  quotedMessage,
  whitelistNames,
  ownNumber,
  onMentionClick,
  onQuoteJump,
  flash = false,
}: MessageBubbleProps) {
  const isOutbound = msg.direction === 'outbound';
  const hasMediaFile = msg.media_status === 'downloaded';
  const hasBody = !!msg.body?.trim();
  const hasTranscript = !!msg.transcript?.trim();
  const hasTranslation =
    msg.translation_status === 'done' && !!(msg.translated_body || msg.transcript_translated);
  const isEmpty = !hasBody && !hasMediaFile && !hasTranscript;
  const isDeleted = !!msg.is_deleted;
  const time = new Date(msg.timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const rowRef = useRef<HTMLDivElement>(null);
  // Bring the focused find match into view when it becomes active.
  useEffect(() => {
    if (activeMatch) rowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeMatch]);

  return (
    <div
      ref={rowRef}
      data-mid={msg.message_id}
      className={cn(
        'group flex items-center gap-1',
        isOutbound ? 'justify-end' : 'justify-start',
        highlighted && 'border-l-[3px] border-primary pl-2',
      )}
    >
      {isOutbound && <MessageBubbleActions message={msg} align="end" onReply={onReply} />}
      <div
        className={cn(
          'flex max-w-[min(70%,480px)] flex-col gap-1.5 px-3.5 py-2.5 text-fg transition-shadow',
          isOutbound
            ? 'rounded-[14px] rounded-br-[4px] bg-primary-soft'
            : 'rounded-[14px] rounded-bl-[4px] border border-line-strong bg-surface-2',
          activeMatch && 'ring-2 ring-warning ring-offset-2 ring-offset-bg',
          flash && !activeMatch && 'ring-2 ring-primary ring-offset-2 ring-offset-bg',
        )}
      >
        {showSender && !isOutbound && msg.sender_name && (
          <span className="text-[11.5px] font-semibold text-primary">{msg.sender_name}</span>
        )}
        {quotedMessage && (
          <QuotedSnippet
            message={quotedMessage}
            whitelistNames={whitelistNames}
            ownNumber={ownNumber}
            onJump={onQuoteJump ? () => onQuoteJump(quotedMessage.message_id) : undefined}
          />
        )}
        {hasMediaFile && <BubbleMedia message={msg} />}
        {hasBody && (
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">
            <MessageBodyText
              body={msg.body ?? ''}
              mentions={msg.mentions}
              whitelistNames={whitelistNames}
              ownNumber={ownNumber}
              findTerm={findTerm}
              onMentionClick={onMentionClick}
            />
          </p>
        )}
        {(msg.message_type === 'ptt' || msg.message_type === 'audio') && (
          <TranscriptBlock msg={msg} findTerm={findTerm} />
        )}
        {isEmpty && <MessageTypeBadge messageType={msg.message_type} />}
        {hasTranslation && (
          <div className="flex items-start gap-1.5 border-t border-line-strong pt-1.5 text-[12.5px] text-fg-secondary">
            <Icon name="languages" size={13} className="mt-0.5 shrink-0 opacity-70" />
            <HighlightText
              className="whitespace-pre-wrap"
              text={msg.translated_body || msg.transcript_translated || ''}
              term={findTerm}
              whole
            />
          </div>
        )}
        {!!msg.reactions?.length && (
          <ReactionChips reactions={msg.reactions} whitelistNames={whitelistNames} ownNumber={ownNumber} />
        )}
        <div className="flex items-center justify-end gap-1.5 text-[10.5px] text-fg-muted">
          {isDeleted && (
            <span title={msg.deleted_at ? `Deleted ${formatDateTime(msg.deleted_at)}` : undefined}>
              <StatusPill tone="danger" label={isOutbound ? 'You deleted this' : 'Deleted by sender'} />
            </span>
          )}
          {msg.transcription_status === 'pending' && (
            <StatusPill tone="warning" label="Transcribing…" pulse />
          )}
          <span title={formatDateTime(msg.timestamp)}>{time}</span>
          {isOutbound && <AckIndicator ack={msg.ack} />}
        </div>
      </div>
      {!isOutbound && <MessageBubbleActions message={msg} align="start" onReply={onReply} />}
    </div>
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Display text for one resolved @mention, in priority order: the connected
 * account's own number ("You" — mirrors the `senderName` convention for own
 * outbound messages), the whitelisted contact's app-curated name, then the
 * WhatsApp-reported name captured at message time, then a formatted phone
 * number (resolved but not whitelisted/named), then the raw placeholder
 * digits unchanged (nothing resolved).
 */
function mentionDisplayText(mention: MessageMention, whitelistNames?: Map<string, string>, ownNumber?: string): string {
  if (ownNumber && mention.number === ownNumber) return '@You';
  const name =
    whitelistNames?.get(mention.number) ??
    mention.name ??
    (mention.number !== mention.id ? formatPhone(mention.number) : mention.id);
  return `@${name}`;
}

/**
 * Renders a message body, replacing each captured @mention's raw "@<id>"
 * placeholder with its resolved display name (see mentionDisplayText).
 * Falls straight through to HighlightText when there are no mentions — the
 * common case stays exactly as before. Plain-text segments around/between
 * mentions still run through HighlightText so in-thread find still works.
 */
export function MessageBodyText({
  body,
  mentions,
  whitelistNames,
  ownNumber,
  findTerm,
  onMentionClick,
}: {
  body: string;
  mentions?: MessageMention[] | null;
  whitelistNames?: Map<string, string>;
  ownNumber?: string;
  findTerm?: string;
  onMentionClick?: (mention: MessageMention) => void;
}) {
  if (!mentions?.length) {
    return <HighlightText text={body} term={findTerm} whole />;
  }

  // Longest id first so a shorter id can't shadow-match a prefix of a longer one.
  const sorted = [...mentions].sort((a, b) => b.id.length - a.id.length);
  const pattern = new RegExp(`@(${sorted.map((m) => escapeRegExp(m.id)).join('|')})`, 'g');
  const byId = new Map(mentions.map((m) => [m.id, m]));
  const parts = body.split(pattern);

  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          const mention = byId.get(part);
          if (!mention) return <span key={i} className="font-semibold text-primary">{`@${part}`}</span>;
          const label = mentionDisplayText(mention, whitelistNames, ownNumber);
          // Clickable only when we have a real number to act on (a failed-LID
          // fallback leaves number === id, an over-long opaque digit string) and
          // it isn't the account's own number — there's no thread to jump to and
          // nothing to whitelist for "You".
          const clickable = onMentionClick && isUsableNumber(mention.number) && mention.number !== ownNumber;
          return clickable ? (
            <button
              key={i}
              type="button"
              onClick={() => onMentionClick!(mention)}
              className="font-semibold text-primary hover:underline"
            >
              {label}
            </button>
          ) : (
            <span key={i} className="font-semibold text-primary">
              {label}
            </span>
          );
        }
        return part ? <HighlightText key={i} text={part} term={findTerm} whole /> : null;
      })}
    </>
  );
}

/** A resolved mention number we can navigate/whitelist to (E.164-ish, 7–15 digits). */
function isUsableNumber(number: string): boolean {
  return /^\d{7,15}$/.test(number);
}

/**
 * The quoted-message strip shown above a bubble's own content when it's a reply.
 * When `onJump` is given it becomes a button that scrolls to the original message.
 */
function QuotedSnippet({
  message,
  whitelistNames,
  ownNumber,
  onJump,
}: {
  message: StoredMessage;
  whitelistNames?: Map<string, string>;
  ownNumber?: string;
  onJump?: () => void;
}) {
  const bodyText = message.body?.trim();
  const text = bodyText || message.transcript?.trim() || '';
  const inner = (
    <>
      {message.sender_name && (
        <span className="text-[11px] font-semibold text-primary">{message.sender_name}</span>
      )}
      {text ? (
        <span className="line-clamp-2">
          {bodyText ? (
            <MessageBodyText
              body={bodyText}
              mentions={message.mentions}
              whitelistNames={whitelistNames}
              ownNumber={ownNumber}
            />
          ) : (
            text
          )}
        </span>
      ) : (
        <MessageTypeBadge messageType={message.message_type} />
      )}
    </>
  );
  const base =
    'flex flex-col gap-0.5 rounded-[6px] border-l-2 border-primary bg-surface px-2 py-1 text-left text-[12px] text-fg-secondary';
  return onJump ? (
    <button type="button" onClick={onJump} className={cn(base, 'hover:bg-surface-2')} title="Jump to message">
      {inner}
    </button>
  ) : (
    <div className={base}>{inner}</div>
  );
}

/**
 * Emoji reactions on a bubble, grouped per emoji with a count when several
 * people picked the same one. The tooltip names the reactors — "You" for the
 * connected account, the whitelist name when known, else a formatted number
 * (same resolution order as @mentions).
 */
function ReactionChips({
  reactions,
  whitelistNames,
  ownNumber,
}: {
  reactions: MessageReaction[];
  whitelistNames?: Map<string, string>;
  ownNumber?: string;
}) {
  const groups = new Map<string, string[]>();
  for (const r of reactions) {
    const who =
      ownNumber && r.sender_number === ownNumber
        ? 'You'
        : (whitelistNames?.get(r.sender_number) ?? formatPhone(r.sender_number));
    const list = groups.get(r.reaction) ?? [];
    list.push(who);
    groups.set(r.reaction, list);
  }
  return (
    <div className="flex flex-wrap gap-1">
      {[...groups.entries()].map(([emoji, whos]) => (
        <span
          key={emoji}
          title={whos.join(', ')}
          className="inline-flex items-center gap-1 rounded-pill border border-line-strong bg-surface px-1.5 py-0.5 text-[12px] leading-none"
        >
          <span>{emoji}</span>
          {whos.length > 1 && (
            <span className="text-[10.5px] font-semibold text-fg-secondary">{whos.length}</span>
          )}
        </span>
      ))}
    </div>
  );
}

/** WhatsApp delivery ticks for an outbound message (clock → ✓ → ✓✓ → blue ✓✓). */
function AckIndicator({ ack }: { ack?: number | null }) {
  if (ack === -1) {
    return <Icon name="alertCircle" size={13} className="text-danger" aria-label="Failed to send" />;
  }
  if (ack == null || ack === 0) {
    return <Icon name="clock" size={12} className="opacity-70" aria-label="Pending" />;
  }
  if (ack === 1) {
    return <Icon name="check" size={13} aria-label="Sent" />;
  }
  // 2 = delivered, ≥3 = read/played (blue).
  return (
    <Icon
      name="checkCheck"
      size={14}
      className={ack >= 3 ? 'text-info' : undefined}
      aria-label={ack >= 3 ? 'Read' : 'Delivered'}
    />
  );
}

function TranscriptBlock({ msg, findTerm }: { msg: StoredMessage; findTerm?: string }) {
  if (msg.transcript) {
    return (
      <p className="whitespace-pre-wrap text-[13px] italic leading-relaxed text-fg-secondary">
        <HighlightText text={msg.transcript} term={findTerm} whole />
      </p>
    );
  }
  if (msg.transcription_status === 'failed') {
    return <span className="text-[12px] text-danger">Transcription failed</span>;
  }
  return null;
}

function BubbleMedia({ message: msg }: { message: StoredMessage }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const url = api.mediaUrl(msg.id);
  const type = msg.media_type ?? msg.message_type;

  if (type === 'image' || type === 'sticker') {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="block overflow-hidden rounded-[10px]"
          aria-label="View image full screen"
        >
          <img
            src={url}
            alt="attachment"
            className="max-h-[280px] w-full cursor-zoom-in rounded-[10px] object-contain transition hover:opacity-95"
          />
        </button>
        {lightboxOpen && <ImageLightbox url={url} onClose={() => setLightboxOpen(false)} />}
      </>
    );
  }
  if (type === 'ptt' || type === 'audio') {
    return <audio controls src={url} className="w-[260px] max-w-full" />;
  }
  if (type === 'video') {
    return <video controls src={url} className="max-h-[280px] w-full rounded-[10px]" />;
  }
  const filename = msg.media_filename || `attachment.${extensionForMimetype(msg.media_mimetype)}`;
  const sizeLabel = msg.media_filesize ? formatBytes(msg.media_filesize) : '';
  return (
    <a
      href={url}
      download={filename}
      target="_blank"
      rel="noopener noreferrer"
      className="flex max-w-[280px] items-center gap-2.5 rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-fg hover:bg-surface-2"
      title={filename}
    >
      <Icon name="fileText" size={20} className="shrink-0 text-fg-muted" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[12.5px] font-medium">{filename}</span>
        <span className="text-[11px] text-fg-muted">
          {[sizeLabel, 'Download'].filter(Boolean).join(' · ')}
        </span>
      </span>
    </a>
  );
}
