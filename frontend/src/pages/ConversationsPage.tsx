import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { ConversationList, threadName } from '@/components/domain/ConversationList';
import { Input } from '@/components/ui/Input';
import { MessageBubble } from '@/components/domain/MessageBubble';
import { ThreadFindBar } from '@/components/domain/ThreadFindBar';
import { DayDivider } from '@/components/domain/DayDivider';
import { ComposeReply } from '@/components/domain/ComposeReply';
import { PhoneNumber } from '@/components/domain/PhoneNumber';
import {
  useThreads,
  useConversationThread,
  useTranslateAll,
  useMarkRead,
  DEFAULT_THREAD_PAGE,
} from '@/hooks/useThreads';
import { useStatus } from '@/hooks/useStatus';
import { useWhitelist, useAddWhitelist } from '@/hooks/useWhitelist';
import { useSummarize } from '@/hooks/useSummaries';
import { SummarizeModal } from '@/components/domain/SummarizeModal';
import { SummaryHistoryModal } from '@/components/domain/SummaryHistoryModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { api } from '@/lib/api';
import { dayKey, formatPhone, normalizeNumber } from '@/lib/format';
import type { ComposeState, MessageMention, StoredMessage, SummarizeInput } from '@/types';

// Newest-page size loaded by useConversationThread; older pages start past it.
const THREAD_PAGE = DEFAULT_THREAD_PAGE;
const OLDER_PAGE = 50;

/** De-duplicate messages by id, keeping first occurrence (older page first). */
function dedupeById(list: StoredMessage[]): StoredMessage[] {
  const seen = new Set<string>();
  const out: StoredMessage[] = [];
  for (const m of list) {
    const key = String(m.id);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(m);
    }
  }
  return out;
}

// ============================================================================
// ConversationsPage — WhatsApp-style two-pane view: whitelisted contacts on
// the left (sorted by last message), chat bubbles for the selected thread on
// the right, with a "Translate all" action for the open conversation and an
// AI-powered reply composer at the bottom.
// ============================================================================

export function ConversationsPage() {
  const {
    data: threads,
    isLoading: threadsLoading,
    isError: threadsError,
    refetch: refetchThreads,
  } = useThreads();
  const { data: whitelist } = useWhitelist();
  // Resolved-mention display names: whitelisted @mentions show the app-curated
  // name instead of the raw WhatsApp id/LID digits (see MessageBubble).
  const whitelistNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of whitelist ?? []) {
      map.set(w.phone_number, w.label || w.ezy_contact_name || w.ezy_bp_name || formatPhone(w.phone_number));
    }
    return map;
  }, [whitelist]);
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = searchParams.get('number');
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  // Whether the message list is pinned to the bottom — drives "follow new
  // messages only if the user is already at the bottom" (WhatsApp behavior).
  const atBottomRef = useRef(true);
  // True right after a thread switch until the first post-switch bottom-jump
  // runs — distinguishes an instant jump-to-bottom (new thread) from a smooth
  // follow (live message arriving while already pinned to the bottom).
  const justSwitchedRef = useRef(true);
  const loadingOlderRef = useRef(false);
  const contentRoRef = useRef<ResizeObserver | null>(null);
  // True for the couple of frames right after WE programmatically move the
  // scroll position — masks the native `scroll` event that follows so
  // `handleScroll` doesn't mistake our own (possibly momentarily short, if
  // content is still growing) jump for the user scrolling away from the
  // bottom, which would otherwise disable the ResizeObserver's re-anchoring.
  const suppressScrollRef = useRef(false);

  const scrollToBottom = (behavior: ScrollBehavior) => {
    suppressScrollRef.current = true;
    bottomRef.current?.scrollIntoView({ block: 'end', behavior });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      suppressScrollRef.current = false;
    }));
  };

  const [composeState, setComposeState] = useState<ComposeState>('idle');
  const [messageCount, setMessageCount] = useState(1);
  const [replyTarget, setReplyTarget] = useState<StoredMessage | null>(null);
  const [search, setSearch] = useState('');
  // Clicking a non-whitelisted @mention stages it here → drives a confirm dialog
  // (add to contacts + open chat). Transient ring after a quote-jump.
  const [confirmMention, setConfirmMention] = useState<MessageMention | null>(null);
  const [flashedId, setFlashedId] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addWhitelist = useAddWhitelist();

  // In-thread find state.
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findActiveIndex, setFindActiveIndex] = useState(0);

  // Older-history paging (prepended to the live newest-500 thread).
  const [older, setOlder] = useState<StoredMessage[]>([]);
  const [olderExhausted, setOlderExhausted] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const summarize = useSummarize();
  const [summarizeOpen, setSummarizeOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [lastSummaryId, setLastSummaryId] = useState<string | number | null>(null);

  const { data: status } = useStatus();
  const outboundEnabled = status?.outboundEnabled ?? false;
  // The connected account's own number — an @mention of it should read as
  // "You" rather than a bare phone number (see whitelistNames/MessageBubble).
  const ownNumber = normalizeNumber(status?.wid ?? '');

  // Default to the most-recent conversation if none is selected.
  useEffect(() => {
    if (!selected && threads && threads.length > 0) {
      setSearchParams({ number: threads[0].id });
    }
  }, [selected, threads, setSearchParams]);

  const {
    data: messages,
    isLoading: threadLoading,
    isError: threadError,
    refetch: refetchThread,
  } = useConversationThread(selected, THREAD_PAGE);
  const translateAll = useTranslateAll();
  const markRead = useMarkRead();

  const filteredThreads = useMemo(() => {
    const all = threads ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((t) => {
      const name = threadName(t).toLowerCase();
      const id = t.id.toLowerCase();
      const phone = formatPhone(t.id).toLowerCase();
      return name.includes(q) || id.includes(q) || phone.includes(q);
    });
  }, [threads, search]);

  // Merge older (manually loaded) history in front of the live newest page.
  const ordered = useMemo(
    () =>
      dedupeById([...older, ...(messages ?? [])]).sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      ),
    [older, messages],
  );

  // Resolves a bubble's `reply_to_message_id` to the quoted message, when it's
  // within the currently loaded window — no extra fetch for the common case.
  const quotedById = useMemo(() => {
    const map = new Map<string, StoredMessage>();
    for (const m of ordered) map.set(m.message_id, m);
    return map;
  }, [ordered]);

  // "Load older" is offered only while the newest page is full (there may be
  // more) or we've already pulled at least one older page and aren't exhausted.
  const baseCount = messages?.length ?? 0;
  const canLoadOlder = !olderExhausted && (baseCount >= THREAD_PAGE || older.length > 0);

  const loadOlder = () => {
    if (!selected || loadingOlderRef.current || olderExhausted) return;
    // Keyset cursor: fetch messages strictly older than the oldest one currently
    // loaded (by timestamp, tie-broken by id). Drift-free — a live message landing
    // mid-request can't shift a numbered offset out from under us and silently skip
    // a row, the way `offset = THREAD_PAGE + older.length` could.
    const oldest = ordered[0];
    if (!oldest) return;
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    api
      .listMessagesByNumber(normalizeNumber(selected), {
        limit: OLDER_PAGE,
        before: new Date(oldest.timestamp).toISOString(),
        beforeId: oldest.id,
      })
      .then((page) => {
        if (page.length < OLDER_PAGE) setOlderExhausted(true);
        if (page.length > 0) {
          setOlder((prev) => dedupeById([...prev, ...page]));
          // Preserve the viewport: keep the same message under the user's eye by
          // adding the height the prepended page introduced.
          requestAnimationFrame(() => {
            const now = scrollRef.current;
            if (now) now.scrollTop = prevTop + (now.scrollHeight - prevHeight);
          });
        }
      })
      .catch((e) =>
        toast({
          tone: 'danger',
          title: 'Couldn’t load older messages',
          description: e instanceof Error ? e.message : 'Please try again.',
        }),
      )
      .finally(() => {
        loadingOlderRef.current = false;
        setLoadingOlder(false);
      });
  };

  // In-thread find: messages whose text (body/transcript/translation) matches.
  const findNeedle = findQuery.trim().toLowerCase();
  const findActive = findOpen && findNeedle.length > 0;
  const matchIds = useMemo(() => {
    if (!findActive) return [] as (string | number)[];
    return ordered
      .filter((m) => {
        const hay = [m.body, m.transcript, m.translated_body, m.transcript_translated]
          .filter(Boolean)
          .join('\n')
          .toLowerCase();
        return hay.includes(findNeedle);
      })
      .map((m) => m.id);
  }, [ordered, findActive, findNeedle]);

  const activeIndex = matchIds.length === 0 ? -1 : Math.min(findActiveIndex, matchIds.length - 1);
  const activeMatchId = activeIndex >= 0 ? matchIds[activeIndex] : null;

  const gotoNext = () => {
    if (matchIds.length === 0) return;
    setFindActiveIndex((Math.max(0, activeIndex) + 1) % matchIds.length);
  };
  const gotoPrev = () => {
    if (matchIds.length === 0) return;
    setFindActiveIndex((Math.max(0, activeIndex) - 1 + matchIds.length) % matchIds.length);
  };

  const openFind = useCallback(() => {
    setFindOpen(true);
    setTimeout(() => findInputRef.current?.focus(), 0);
  }, []);
  const closeFind = useCallback(() => {
    setFindOpen(false);
    setFindQuery('');
    setFindActiveIndex(0);
  }, []);

  // Reset the active match when the search term changes.
  useEffect(() => {
    setFindActiveIndex(0);
  }, [findNeedle]);

  // Keyboard: `/` or Ctrl/Cmd+F opens find, scoped to the conversation pane.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      const isFindCombo = (e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'F');
      const isSlash = e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey;
      if (!isFindCombo && !isSlash) return;
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      // Don't steal focus while composing a reply / searching — for either the
      // `/` shortcut or Ctrl/Cmd+F.
      if (typing) return;
      const inPane = !!target && (paneRef.current?.contains(target) ?? false);
      if (!inPane && document.activeElement !== document.body) return;
      e.preventDefault();
      openFind();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected, openFind]);

  // Mark the open thread read (clears unread + WhatsApp sendSeen) when it's
  // opened, when a new message lands while watching, or when the tab regains
  // focus — but only while the tab is actually visible, mirroring WhatsApp Web.
  const lastMessageId = ordered.at(-1)?.id;
  useEffect(() => {
    if (!selected) return;
    const mark = () => {
      if (!document.hidden) markRead.mutate(selected);
    };
    mark();
    document.addEventListener('visibilitychange', mark);
    return () => document.removeEventListener('visibilitychange', mark);
    // markRead.mutate is stable; re-run only when the thread or its tail changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, lastMessageId]);

  const highlightedIds = useMemo(() => {
    if (composeState === 'idle') return new Set<string | number>();
    const tail = ordered.slice(-Math.min(messageCount, ordered.length));
    return new Set(tail.map((m) => m.id));
  }, [ordered, composeState, messageCount]);

  const resetCompose = () => {
    setComposeState('idle');
  };

  const handleReply = (message: StoredMessage) => {
    setReplyTarget(message);
    if (composeState === 'idle') setComposeState('composing');
  };

  // Click a resolved @mention: whitelisted → jump to their thread; otherwise
  // confirm adding them to contacts (using the captured WhatsApp name) so the
  // user can message them directly.
  const handleMentionClick = (mention: MessageMention) => {
    if (whitelistNames.has(mention.number)) {
      setSearchParams({ number: mention.number });
    } else {
      setConfirmMention(mention);
    }
  };

  const confirmAddMention = () => {
    if (!confirmMention) return;
    const { number, name } = confirmMention;
    addWhitelist.mutate(
      { number, label: name ?? undefined },
      {
        onSuccess: () => {
          setConfirmMention(null);
          setSearchParams({ number });
          toast({ tone: 'success', title: `Added ${name || formatPhone(number)} to contacts` });
        },
        onError: (e) =>
          toast({
            tone: 'danger',
            title: 'Could not add contact',
            description: e instanceof Error ? e.message : 'Please try again.',
          }),
      },
    );
  };

  // Click a quoted-reply strip: scroll the original message into view and flash
  // it. The strip only renders when the original is already loaded, so it's in
  // the DOM (looked up by its data-mid).
  const handleQuoteJump = (messageId: string) => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-mid="${CSS.escape(messageId)}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setFlashedId(messageId);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashedId(null), 1500);
  };

  // Clear the quote-jump flash timer on unmount (avoids a stray setState).
  useEffect(() => () => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || suppressScrollRef.current) return;
    // Consider "at bottom" with a small slack so a few px never breaks follow.
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (el.scrollTop < 100 && canLoadOlder && !loadingOlderRef.current) {
      loadOlder();
    }
  };

  // On thread switch: reset older-history + find + compose, and mark the next
  // bottom-jump as an instant (non-animated) one. Keyed on `selected` so EVERY
  // entry path resets the parent-owned compose panel — sidebar click, search
  // navigation, or a direct `?number=` URL — not just the sidebar handler (else
  // you land on a new thread with a stale 'preview'/'sending' panel).
  useEffect(() => {
    atBottomRef.current = true;
    justSwitchedRef.current = true;
    setOlder([]);
    setOlderExhausted(false);
    setLoadingOlder(false);
    setFindOpen(false);
    setFindQuery('');
    setFindActiveIndex(0);
    setComposeState('idle');
    setMessageCount(1);
    setReplyTarget(null);
  }, [selected]);

  // Jump to the bottom whenever the tail of the thread changes while pinned
  // there — instantly right after a thread switch (`justSwitchedRef`), smoothly
  // for a live/sent message arriving afterward. Keyed on the LAST message's id
  // (not just `ordered.length`) because `messages` is a fixed-size newest-N
  // window: sending/receiving a message can shift it (one drops out as one
  // comes in) without changing the total count, which would silently starve a
  // length-only dependency. `selected` is included too so a switch to an
  // already-cached thread with the same tail still forces a re-jump instead of
  // silently keeping the previous thread's scroll position. Reuses the
  // `lastMessageId` declared above for the mark-read effect.
  useEffect(() => {
    if (!atBottomRef.current || ordered.length === 0) return;
    scrollToBottom(justSwitchedRef.current ? 'auto' : 'smooth');
    justSwitchedRef.current = false;
    // Safety net alongside the ResizeObserver below: images/video/audio can
    // still be mid-fetch when this runs and grow the container a bit later.
    // Re-sync a couple more times shortly after so a slow-loading attachment
    // can't leave the view stranded short of the true bottom.
    const timers = [100, 400, 1200].map((ms) =>
      setTimeout(() => {
        if (atBottomRef.current) scrollToBottom('auto');
      }, ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [selected, ordered.length, lastMessageId]);

  // Re-anchor to the true bottom whenever the message list's content grows after
  // the fact (image/video/audio finishing load, a translation expanding a bubble)
  // while the user is pinned to the bottom. A callback ref is used (not a plain
  // ref + effect) because this wrapper div is torn down/recreated across the
  // loading/error/empty/populated branches and across thread switches.
  const contentRef = useCallback((node: HTMLDivElement | null) => {
    contentRoRef.current?.disconnect();
    contentRoRef.current = null;
    if (!node) return;
    const ro = new ResizeObserver(() => {
      if (atBottomRef.current) scrollToBottom('auto');
    });
    ro.observe(node);
    contentRoRef.current = ro;
  }, []);

  const untranslatedCount = ordered.filter(
    (m) => m.translation_status !== 'done' && !!(m.body?.trim() || m.transcript?.trim()),
  ).length;

  const selectedThread = threads?.find((t) => t.id === selected);
  const isGroup = selectedThread?.type === 'group';
  const name = selectedThread
    ? selectedThread.label || (isGroup ? selectedThread.id : formatPhone(selectedThread.id))
    : '';

  const onTranslateAll = () => {
    if (!selected) return;
    translateAll.mutate(selected, {
      onSuccess: (r) =>
        toast({
          tone: 'success',
          title: 'Translation complete',
          description: `${r.translated} translated${r.skipped ? `, ${r.skipped} skipped` : ''}${r.failed ? `, ${r.failed} failed` : ''}.`,
        }),
      onError: (e) =>
        toast({
          tone: 'danger',
          title: 'Translation failed',
          description: e instanceof Error ? e.message : 'Please try again.',
        }),
    });
  };

  const onSummarize = (input: SummarizeInput) => {
    if (!selected) return;
    summarize.mutate(
      { number: selected, input },
      {
        onSuccess: (saved) => {
          setSummarizeOpen(false);
          setLastSummaryId(saved.id);
          setHistoryOpen(true);
          toast({ tone: 'success', title: 'Summary ready', description: saved.title });
        },
        onError: (e) =>
          toast({
            tone: 'danger',
            title: 'Summarize failed',
            description: e instanceof Error ? e.message : 'Please try again.',
          }),
      },
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Conversations" subtitle="Full threads for whitelisted contacts and monitored groups." />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex w-[300px] shrink-0 flex-col border-r border-line-strong bg-surface">
          <div className="shrink-0 border-b border-line-strong p-2.5">
            <Input
              type="search"
              icon="search"
              placeholder="Search conversations…"
              value={search}
              onChange={setSearch}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {threadsError ? (
              <ErrorState
                title="Couldn't load conversations"
                description="The conversation list failed to load."
                onRetry={() => void refetchThreads()}
              />
            ) : (
              <ConversationList
                threads={filteredThreads}
                selected={selected}
                onSelect={(number) => setSearchParams({ number })}
                loading={threadsLoading}
              />
            )}
          </div>
        </div>

        <div ref={paneRef} className="flex min-w-0 flex-1 flex-col overflow-hidden bg-bg">
          {!selected ? (
            <EmptyState
              icon="messageSquare"
              title="No conversation selected"
              description="Pick a conversation from the list."
            />
          ) : (
            <>
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line-strong bg-surface px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <Avatar personName={name} size="sm" />
                  <div className="flex flex-col">
                    <span className="flex items-center gap-1.5 text-[14px] font-bold text-fg">
                      {isGroup && <Icon name="users" size={14} className="shrink-0 text-fg-muted" />}
                      {name}
                    </span>
                    {isGroup ? (
                      <span className="text-[11.5px] text-fg-muted">{selectedThread?.bp || 'Group'}</span>
                    ) : (
                      <PhoneNumber value={selected} fontSize="11.5px" />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <IconButton
                    icon="search"
                    size="sm"
                    variant="solid"
                    ariaLabel="Find in conversation"
                    onClick={() => (findOpen ? closeFind() : openFind())}
                  />
                  <Button
                    variant="secondary"
                    icon="sparkles"
                    size="sm"
                    label="Summarize"
                    onClick={() => setSummarizeOpen(true)}
                  />
                  <Button
                    variant="secondary"
                    icon="clock"
                    size="sm"
                    label="History"
                    onClick={() => {
                      setLastSummaryId(null);
                      setHistoryOpen(true);
                    }}
                  />
                  <Button
                    variant="secondary"
                    icon="download"
                    size="sm"
                    label="Export"
                    onClick={() => {
                      // Trigger a real file download in place — an <a download>
                      // click, not window.open (which just opens a stray tab and
                      // navigates instead of saving the attachment).
                      const a = document.createElement('a');
                      a.href = api.exportUrl(selected, 'csv');
                      a.download = ''; // honor the server's Content-Disposition filename
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                    }}
                  />
                  <Button
                    variant="secondary"
                    icon="languages"
                    size="sm"
                    loading={translateAll.isPending}
                    disabled={untranslatedCount === 0}
                    label={untranslatedCount > 0 ? `Translate all (${untranslatedCount})` : 'All translated'}
                    onClick={onTranslateAll}
                  />
                </div>
              </div>

              {findOpen && (
                <div className="flex shrink-0 items-center justify-end border-b border-line-strong bg-surface px-5 py-2">
                  <ThreadFindBar
                    ref={findInputRef}
                    query={findQuery}
                    onQueryChange={setFindQuery}
                    matchCount={matchIds.length}
                    activeIndex={activeIndex}
                    onPrev={gotoPrev}
                    onNext={gotoNext}
                    onClose={closeFind}
                  />
                </div>
              )}

              <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {threadLoading ? (
                  <div className="text-[13px] text-fg-muted">Loading…</div>
                ) : threadError ? (
                  <ErrorState
                    title="Couldn't load messages"
                    description="This conversation failed to load."
                    onRetry={() => void refetchThread()}
                  />
                ) : ordered.length === 0 ? (
                  <EmptyState
                    icon="messageSquare"
                    title="No messages yet"
                    description="Nothing captured for this contact yet."
                  />
                ) : (
                  <div ref={contentRef} className="flex flex-col gap-2.5">
                    {canLoadOlder && (
                      <div className="flex justify-center py-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="chevronUp"
                          loading={loadingOlder}
                          label="Load older messages"
                          onClick={loadOlder}
                        />
                      </div>
                    )}
                    {olderExhausted && older.length > 0 && (
                      <div className="py-1 text-center text-[11.5px] text-fg-muted">
                        Beginning of conversation
                      </div>
                    )}
                    {ordered.map((m, i) => {
                      const prev = ordered[i - 1];
                      const showDivider = !prev || dayKey(prev.timestamp) !== dayKey(m.timestamp);
                      return (
                        <Fragment key={m.id}>
                          {showDivider && <DayDivider timestamp={m.timestamp} />}
                          <MessageBubble
                            message={m}
                            highlighted={highlightedIds.has(m.id)}
                            showSender={isGroup}
                            findTerm={findActive ? findQuery.trim() : undefined}
                            activeMatch={activeMatchId != null && m.id === activeMatchId}
                            onReply={handleReply}
                            quotedMessage={m.reply_to_message_id ? quotedById.get(m.reply_to_message_id) : undefined}
                            whitelistNames={whitelistNames}
                            ownNumber={ownNumber}
                            onMentionClick={handleMentionClick}
                            onQuoteJump={handleQuoteJump}
                            flash={flashedId === m.message_id}
                          />
                        </Fragment>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              {outboundEnabled ? (
                <ComposeReply
                  key={selected}
                  contactNumber={selected}
                  isGroup={isGroup}
                  messageCount={messageCount}
                  onMessageCountChange={setMessageCount}
                  composeState={composeState}
                  onComposeStateChange={(state) => {
                    if (state === 'idle') {
                      resetCompose();
                    } else {
                      setComposeState(state);
                    }
                  }}
                  onSend={() => {
                    atBottomRef.current = true;
                  }}
                  replyTarget={replyTarget}
                  onClearReply={() => setReplyTarget(null)}
                  whitelistNames={whitelistNames}
                />
              ) : (
                <div className="shrink-0 border-t border-line-strong bg-surface px-5 py-3 text-center text-[12px] text-fg-muted">
                  <Icon name="lock" size={13} className="mr-1.5 inline-block opacity-60" />
                  Outbound messaging is disabled
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <SummarizeModal
        open={summarizeOpen}
        submitting={summarize.isPending}
        onClose={() => setSummarizeOpen(false)}
        onSubmit={onSummarize}
      />
      <SummaryHistoryModal
        open={historyOpen}
        number={selected}
        initialId={lastSummaryId}
        onClose={() => setHistoryOpen(false)}
      />
      <ConfirmDialog
        open={confirmMention !== null}
        title="Add to contacts?"
        description={
          confirmMention
            ? `Add ${confirmMention.name || formatPhone(confirmMention.number)} to your contacts and open a chat? You'll be able to message them directly.`
            : undefined
        }
        confirmLabel="Add & open"
        loading={addWhitelist.isPending}
        onConfirm={confirmAddMention}
        onCancel={() => setConfirmMention(null)}
      />
    </div>
  );
}
