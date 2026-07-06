import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { useToast } from '@/components/ui/Toast';
import { MessageTypeBadge } from './MessageTypeBadge';
import { MessageBodyText } from './MessageBubble';
import { MentionAutocomplete } from './MentionAutocomplete';
import { cn } from '@/lib/cn';
import { fileToBase64 } from '@/lib/file';
import { formatBytes, formatPhone } from '@/lib/format';
import type { ComposeState, DraftReplyResult, GroupParticipant, StoredMessage } from '@/types';
import { useDraftReply, useSendMessage } from '@/hooks/useDraftReply';
import { useGroupParticipants } from '@/hooks/useGroups';

// A mention the user inserted into the draft: the exact visible `@Name` token,
// the WhatsApp `@<user>` token to swap in at send, and the jid to tag.
interface DraftMention {
  display: string;
  user: string;
  jid: string;
}

// The active `@query` token immediately before the caret (start = index of '@').
function detectMention(value: string, caret: number): { query: string; start: number } | null {
  const upto = value.slice(0, caret);
  const m = /(?:^|\s)@([^\s@]*)$/.exec(upto);
  if (!m) return null;
  return { query: m[1], start: caret - m[1].length - 1 };
}

// Rewrite the visible draft into what WhatsApp receives: each still-present
// `@Name` token → `@<user>` (the digits WhatsApp anchors the mention on), and
// collect that mention's jid. Mentions the user deleted are silently dropped.
function buildOutgoing(text: string, mentions: DraftMention[]): { body: string; mentions: string[] } {
  let body = text;
  const jids: string[] = [];
  for (const m of mentions) {
    const idx = body.indexOf(m.display);
    if (idx === -1) continue;
    body = body.slice(0, idx) + `@${m.user}` + body.slice(idx + m.display.length);
    jids.push(m.jid);
  }
  return { body, mentions: jids };
}

interface StagedAttachment {
  file: File;
  previewUrl: string;
  data: string;
  mimetype: string;
  filename?: string;
}

// Mirrors the backend's OUTBOUND_MEDIA_MAX_BYTES default (src/config/env.ts) —
// a client-side fail-fast only; the server remains authoritative and its own
// rejection would still surface through the existing onError toast either way.
const MAX_ATTACHMENT_BYTES = 16 * 1024 * 1024;

export interface ComposeReplyProps {
  contactNumber: string;
  /** Target is a monitored group (routes the send to the group chat). */
  isGroup?: boolean;
  messageCount: number;
  onMessageCountChange: (count: number) => void;
  composeState: ComposeState;
  onComposeStateChange: (state: ComposeState) => void;
  /** Called the instant a send is kicked off, so the thread view can snap to the bottom. */
  onSend?: () => void;
  /** The message being quoted, if the user picked "Reply" on a bubble. */
  replyTarget: StoredMessage | null;
  /** Clears the active quote target (its own "x" button, or a full compose reset). */
  onClearReply: () => void;
  /** phone_number → display name, for resolving @mentions in the quoted-reply preview. */
  whitelistNames?: Map<string, string>;
}

const LANGUAGE_LABELS: Record<string, string> = { es: 'Spanish', en: 'English', he: 'Hebrew' };

export function ComposeReply({
  contactNumber,
  isGroup = false,
  messageCount,
  onMessageCountChange,
  composeState,
  onComposeStateChange,
  onSend,
  replyTarget,
  onClearReply,
  whitelistNames,
}: ComposeReplyProps) {
  const [draft, setDraft] = useState('');
  const [englishDraft, setEnglishDraft] = useState('');
  const [translatedDraft, setTranslatedDraft] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [sendingWhich, setSendingWhich] = useState<'english' | 'translated' | null>(null);
  const [attachment, setAttachment] = useState<StagedAttachment | null>(null);
  const attachmentRef = useRef<StagedAttachment | null>(null);
  attachmentRef.current = attachment;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // @-mention state (groups only): the active query token, the highlighted row,
  // and the mentions inserted so far (for the send-time body rewrite).
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [selectedMentions, setSelectedMentions] = useState<DraftMention[]>([]);
  const participants = useGroupParticipants(contactNumber, isGroup && mention !== null);
  const mentionCandidates = useMemo<GroupParticipant[]>(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return (participants.data ?? [])
      .filter((p) => !q || (p.name ?? '').toLowerCase().includes(q) || p.number.includes(q))
      .slice(0, 6);
  }, [mention, participants.data]);

  const draftReply = useDraftReply();
  const sendMessage = useSendMessage();

  const isEngaged = composeState !== 'idle';
  const showEditors = composeState === 'preview' || composeState === 'sending';
  const isBusy = composeState === 'generating' || composeState === 'sending';
  const needsTranslation = showEditors && translatedDraft.trim() !== '';
  const targetLangLabel = LANGUAGE_LABELS[targetLanguage] || targetLanguage;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [draft, englishDraft]);

  // Picking "Reply" on a bubble should land the cursor ready to type.
  useEffect(() => {
    if (replyTarget) textareaRef.current?.focus();
  }, [replyTarget]);

  // Opening a conversation should land the cursor ready to type.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Revoke a staged preview URL on unmount — this component remounts on every
  // conversation switch (`key={selected}` in ConversationsPage.tsx), so this
  // is a real leak path, not theoretical.
  useEffect(() => {
    return () => {
      if (attachmentRef.current) URL.revokeObjectURL(attachmentRef.current.previewUrl);
    };
  }, []);

  const clearAttachment = () => {
    setAttachment((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  };

  const stageFile = async (file: File) => {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast({
        tone: 'danger',
        title: 'File too large',
        description: `Max ${Math.floor(MAX_ATTACHMENT_BYTES / (1024 * 1024))}MB`,
      });
      return;
    }
    try {
      const encoded = await fileToBase64(file);
      const previewUrl = URL.createObjectURL(file);
      setAttachment((prev) => {
        if (prev) URL.revokeObjectURL(prev.previewUrl); // single-attachment model: replace, don't stack
        return { file, previewUrl, ...encoded };
      });
      if (composeState === 'idle') onComposeStateChange('composing');
    } catch {
      toast({ tone: 'danger', title: 'Could not read file' });
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (isBusy || showEditors) return; // attaching only allowed pre-generate
    const item = Array.from(e.clipboardData?.items ?? []).find((it) => it.kind === 'file');
    if (!item) return; // plain text paste — let the default happen
    const file = item.getAsFile();
    if (!file) return;
    e.preventDefault();
    void stageFile(file);
  };

  const resetState = () => {
    setDraft('');
    setEnglishDraft('');
    setTranslatedDraft('');
    setSendingWhich(null);
    setSelectedMentions([]);
    setMention(null);
    clearAttachment();
    onComposeStateChange('idle');
    onClearReply();
    // The textarea is disabled while sending — re-enabling happens on this same
    // render, so wait a frame before stealing focus back for the next message.
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  // Replace the active `@query` token with the picked person's `@Name` and
  // record the mention (for the send-time body rewrite). Keeps the caret after
  // the inserted token.
  const acceptMention = (p: GroupParticipant) => {
    if (!mention) return;
    const display = `@${p.name ?? formatPhone(p.number)}`;
    const before = draft.slice(0, mention.start);
    const after = draft.slice(mention.start + 1 + mention.query.length);
    const insert = `${display} `;
    setDraft(before + insert + after);
    setSelectedMentions((prev) => [...prev, { display, user: p.user, jid: p.jid }]);
    setMention(null);
    const caret = before.length + insert.length;
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(caret, caret);
      }
    });
  };

  const doSend = (text: string, which: 'english' | 'translated', mentions: string[] = []) => {
    const messageToSend = text.trim();
    if (!messageToSend && !attachment) return;
    setSendingWhich(which);
    onComposeStateChange('sending');
    onSend?.();
    sendMessage.mutate(
      {
        number: contactNumber,
        message: messageToSend,
        isGroup,
        quotedMessageId: replyTarget?.message_id,
        attachment: attachment
          ? { data: attachment.data, mimetype: attachment.mimetype, filename: attachment.filename }
          : undefined,
        mentions: mentions.length ? mentions : undefined,
      },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: 'Message sent' });
          resetState();
        },
        onError: (err: Error) => {
          toast({ tone: 'danger', title: 'Send failed', description: err.message });
          setSendingWhich(null);
          onComposeStateChange('preview');
        },
      },
    );
  };

  const handleGenerate = () => {
    if (!draft.trim() || attachment) return;
    onComposeStateChange('generating');
    draftReply.mutate(
      { number: contactNumber, draft: draft.trim(), messageCount },
      {
        onSuccess: (result: DraftReplyResult) => {
          setEnglishDraft(result.english);
          setTranslatedDraft(result.translated ?? '');
          setTargetLanguage(result.targetLanguage);
          onComposeStateChange('preview');
        },
        onError: (err: Error) => {
          toast({ tone: 'danger', title: 'Draft failed', description: err.message });
          onComposeStateChange('composing');
        },
      },
    );
  };

  const handleDirectSend = () => {
    if ((!draft.trim() && !attachment) || isBusy) return;
    // Groups: rewrite `@Name` tokens → `@<user>` + collect jids so WhatsApp tags
    // them. (Mentions apply to this direct-send path only — the AI-draft path
    // rewrites the text and would lose the tokens.)
    const { body, mentions } = isGroup ? buildOutgoing(draft, selectedMentions) : { body: draft, mentions: [] };
    doSend(body, 'english', mentions);
    setDraft('');
    setSelectedMentions([]);
    clearAttachment();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // When the @-mention picker is open, it owns the navigation keys.
    if (mention && mentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionCandidates.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        acceptMention(mentionCandidates[Math.min(mentionIndex, mentionCandidates.length - 1)]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMention(null);
        return;
      }
    }

    const mod = e.ctrlKey || e.metaKey;
    if (composeState === 'composing' && mod && e.key === 'Enter') {
      e.preventDefault();
      handleDirectSend(); // Ctrl/Cmd+Enter → send
    } else if (composeState === 'composing' && mod && (e.key === 'g' || e.key === 'G')) {
      e.preventDefault();
      handleGenerate(); // Ctrl/Cmd+G → generate
    } else if (e.key === 'Escape' && isEngaged) {
      e.preventDefault();
      resetState();
    }
    // plain Enter (and Shift+Enter): no handling → textarea inserts a newline
  };

  // Re-scan for an active `@query` after a draft edit (groups only).
  const refreshMention = (value: string, caret: number | null) => {
    if (!isGroup) return;
    const found = detectMention(value, caret ?? value.length);
    setMention(found);
    setMentionIndex(0);
  };

  const DraftRow = ({
    label,
    value,
    onChange,
    onSend,
    which,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    onSend: () => void;
    which: 'english' | 'translated';
  }) => (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[11.5px] font-bold uppercase tracking-wider text-fg-muted">
          Send in {label}
        </span>
        <Button
          variant="primary"
          size="sm"
          icon="send"
          label="Send"
          loading={sendingWhich === which && composeState === 'sending'}
          disabled={!value.trim() || isBusy}
          onClick={onSend}
        />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isBusy}
        rows={2}
        className="w-full resize-none rounded-[10px] border border-line-strong bg-bg px-3 py-2 text-[13.5px] text-fg placeholder:text-fg-muted focus:border-primary focus:outline-none disabled:opacity-60"
        placeholder="…"
      />
    </div>
  );

  return (
    <div className="shrink-0 border-t border-line-strong bg-surface">
      {replyTarget && (
        <div className="flex items-center gap-2 border-b border-line-strong px-4 py-2">
          <Icon name="reply" size={14} className="shrink-0 text-fg-muted" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[11px] font-semibold text-primary">
              Replying to {replyTarget.direction === 'outbound' ? 'yourself' : replyTarget.sender_name || 'them'}
            </span>
            {replyTarget.body?.trim() ? (
              <span className="truncate text-[12.5px] text-fg-secondary">
                <MessageBodyText
                  body={replyTarget.body.trim()}
                  mentions={replyTarget.mentions}
                  whitelistNames={whitelistNames}
                />
              </span>
            ) : replyTarget.transcript?.trim() ? (
              <span className="truncate text-[12.5px] text-fg-secondary">{replyTarget.transcript.trim()}</span>
            ) : (
              <MessageTypeBadge messageType={replyTarget.message_type} />
            )}
          </div>
          <IconButton icon="x" size="sm" variant="ghost" ariaLabel="Cancel reply" onClick={onClearReply} />
        </div>
      )}
      {showEditors && (
        <div className="flex flex-col gap-3 px-4 pt-3">
          {needsTranslation && (
            <DraftRow
              label={targetLangLabel}
              value={translatedDraft}
              onChange={setTranslatedDraft}
              which="translated"
              onSend={() => doSend(translatedDraft, 'translated')}
            />
          )}

          <DraftRow
            label="English"
            value={englishDraft}
            onChange={setEnglishDraft}
            which="english"
            onSend={() => doSend(englishDraft, 'english')}
          />

          <div className="flex items-center justify-between gap-2 pb-1">
            <Button variant="secondary" size="sm" icon="x" label="Cancel" onClick={resetState} disabled={isBusy} />
            {composeState === 'preview' && (
              <Button variant="secondary" size="sm" icon="sparkles" label="Retry" onClick={handleGenerate} />
            )}
          </div>
        </div>
      )}

      <div className={cn('px-4', showEditors ? 'pb-3' : 'py-3')}>
        {attachment && (
          <div className="mb-2 flex items-center gap-2 rounded-[10px] border border-line-strong bg-bg px-2 py-1.5">
            {attachment.mimetype.startsWith('image/') ? (
              <img src={attachment.previewUrl} alt="" className="h-10 w-10 shrink-0 rounded-[6px] object-cover" />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] bg-surface-2">
                <Icon
                  name={
                    attachment.mimetype.startsWith('video/')
                      ? 'video'
                      : attachment.mimetype.startsWith('audio/')
                        ? 'mic'
                        : 'fileText'
                  }
                  size={18}
                  className="text-fg-muted"
                />
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[12.5px] text-fg">{attachment.filename || 'attachment'}</span>
              <span className="text-[11px] text-fg-muted">{formatBytes(attachment.file.size)}</span>
            </div>
            <IconButton
              icon="x"
              size="sm"
              variant="ghost"
              ariaLabel="Remove attachment"
              onClick={clearAttachment}
              disabled={isBusy}
            />
          </div>
        )}
        <div className="flex items-start gap-2">
          <div className="relative flex flex-1 flex-col gap-1">
            {mention && (
              <MentionAutocomplete
                candidates={mentionCandidates}
                activeIndex={mentionIndex}
                onSelect={acceptMention}
                onHover={setMentionIndex}
              />
            )}
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (composeState === 'idle') onComposeStateChange('composing');
                refreshMention(e.target.value, e.target.selectionStart);
              }}
              onFocus={() => {
                if (composeState === 'idle') onComposeStateChange('composing');
              }}
              onClick={(e) => refreshMention(e.currentTarget.value, e.currentTarget.selectionStart)}
              onKeyUp={(e) => {
                // Caret-moving keys (arrows/home/end) can enter or leave an @token
                // without changing the text — re-scan. Skip keys the picker owns.
                if (mention && ['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) return;
                refreshMention(e.currentTarget.value, e.currentTarget.selectionStart);
              }}
              onBlur={() => setMention(null)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              disabled={isBusy}
              rows={1}
              placeholder={
                attachment
                  ? 'Add a caption (optional)…'
                  : isGroup
                    ? 'Write a message — type @ to mention someone…'
                    : 'Write what you want to say — AI will polish it into a natural reply…'
              }
              className="w-full resize-none rounded-[10px] border border-line-strong bg-bg px-3 py-2 text-[13.5px] text-fg placeholder:text-fg-muted focus:border-primary focus:outline-none disabled:opacity-60"
            />
            <div className="flex items-center gap-1.5 text-[11.5px] text-fg-muted">
              <span>Context:</span>
              <button
                type="button"
                className="flex h-5 w-5 items-center justify-center rounded-[4px] border border-line-strong bg-bg text-fg-muted hover:text-fg disabled:opacity-40"
                disabled={isBusy || messageCount <= 1}
                onClick={() => onMessageCountChange(Math.max(1, messageCount - 1))}
              >
                <Icon name="minus" size={12} />
              </button>
              <span className="font-mono text-[12px] text-fg">{messageCount}</span>
              <button
                type="button"
                className="flex h-5 w-5 items-center justify-center rounded-[4px] border border-line-strong bg-bg text-fg-muted hover:text-fg disabled:opacity-40"
                disabled={isBusy || messageCount >= 20}
                onClick={() => onMessageCountChange(Math.min(20, messageCount + 1))}
              >
                <Icon name="plus" size={12} />
              </button>
              <span>message{messageCount !== 1 ? 's' : ''}</span>
              <span className="ml-auto hidden text-fg-muted sm:inline">
                <kbd className="font-sans">Ctrl+Enter</kbd> send · <kbd className="font-sans">Ctrl+G</kbd> generate
              </span>
            </div>
          </div>

          <div className="flex items-start gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              disabled={isBusy || showEditors}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void stageFile(file);
                e.target.value = ''; // allow re-selecting the same file later
              }}
            />
            <IconButton
              icon="paperclip"
              ariaLabel="Attach file"
              variant="solid"
              size="sm"
              disabled={isBusy || showEditors}
              onClick={() => fileInputRef.current?.click()}
            />
            <Button
              variant="secondary"
              size="sm"
              icon="sparkles"
              label="Generate"
              loading={composeState === 'generating'}
              disabled={
                composeState === 'generating' ||
                composeState === 'preview' ||
                composeState === 'sending' ||
                !draft.trim() ||
                Boolean(attachment)
              }
              title={attachment ? 'Generate is disabled while a file is attached — use Send' : undefined}
              onClick={handleGenerate}
            />
            <Button
              variant="primary"
              size="sm"
              icon="send"
              label="Send"
              disabled={
                (!draft.trim() && !attachment) ||
                composeState === 'generating' ||
                composeState === 'preview' ||
                composeState === 'sending'
              }
              onClick={handleDirectSend}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
