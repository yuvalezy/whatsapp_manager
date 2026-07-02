import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { ConversationList, threadName } from '@/components/domain/ConversationList';
import { Input } from '@/components/ui/Input';
import { MessageBubble } from '@/components/domain/MessageBubble';
import { ComposeReply } from '@/components/domain/ComposeReply';
import { PhoneNumber } from '@/components/domain/PhoneNumber';
import { useThreads, useConversationThread, useTranslateAll, useMarkRead } from '@/hooks/useThreads';
import { useStatus } from '@/hooks/useStatus';
import { useSummarize } from '@/hooks/useSummaries';
import { SummarizeModal } from '@/components/domain/SummarizeModal';
import { SummaryHistoryModal } from '@/components/domain/SummaryHistoryModal';
import { formatPhone } from '@/lib/format';
import type { ComposeState, SummarizeInput } from '@/types';

// ============================================================================
// ConversationsPage — WhatsApp-style two-pane view: whitelisted contacts on
// the left (sorted by last message), chat bubbles for the selected thread on
// the right, with a "Translate all" action for the open conversation and an
// AI-powered reply composer at the bottom.
// ============================================================================

export function ConversationsPage() {
  const { data: threads, isLoading: threadsLoading } = useThreads();
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = searchParams.get('number');
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Whether the message list is pinned to the bottom — drives "follow new
  // messages only if the user is already at the bottom" (WhatsApp behavior).
  const atBottomRef = useRef(true);

  const [composeState, setComposeState] = useState<ComposeState>('idle');
  const [messageCount, setMessageCount] = useState(1);
  const [search, setSearch] = useState('');
  const summarize = useSummarize();
  const [summarizeOpen, setSummarizeOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [lastSummaryId, setLastSummaryId] = useState<string | number | null>(null);

  const { data: status } = useStatus();
  const outboundEnabled = status?.outboundEnabled ?? false;

  // Default to the most-recent conversation if none is selected.
  useEffect(() => {
    if (!selected && threads && threads.length > 0) {
      setSearchParams({ number: threads[0].id });
    }
  }, [selected, threads, setSearchParams]);

  const { data: messages, isLoading: threadLoading } = useConversationThread(selected);
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

  const ordered = useMemo(
    () =>
      [...(messages ?? [])].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      ),
    [messages],
  );

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

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    // Consider "at bottom" with a small slack so a few px never breaks follow.
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  // On thread switch: always jump to the newest message (instant).
  useEffect(() => {
    atBottomRef.current = true;
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [selected]);

  // On a new message: follow to the bottom only if we were already pinned there.
  useEffect(() => {
    if (atBottomRef.current) bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [ordered.length]);

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
            <ConversationList
              threads={filteredThreads}
              selected={selected}
              onSelect={(number) => {
                setSearchParams({ number });
                setComposeState('idle');
              }}
              loading={threadsLoading}
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-bg">
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
                    icon="languages"
                    size="sm"
                    loading={translateAll.isPending}
                    disabled={untranslatedCount === 0}
                    label={untranslatedCount > 0 ? `Translate all (${untranslatedCount})` : 'All translated'}
                    onClick={onTranslateAll}
                  />
                </div>
              </div>

              <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {threadLoading ? (
                  <div className="text-[13px] text-fg-muted">Loading…</div>
                ) : ordered.length === 0 ? (
                  <EmptyState
                    icon="messageSquare"
                    title="No messages yet"
                    description="Nothing captured for this contact yet."
                  />
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {ordered.map((m) => (
                      <MessageBubble
                        key={m.id}
                        message={m}
                        highlighted={highlightedIds.has(m.id)}
                        showSender={isGroup}
                      />
                    ))}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              {outboundEnabled ? (
                <ComposeReply
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
    </div>
  );
}
