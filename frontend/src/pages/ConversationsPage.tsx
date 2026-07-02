import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';
import { ConversationList } from '@/components/domain/ConversationList';
import { MessageBubble } from '@/components/domain/MessageBubble';
import { PhoneNumber } from '@/components/domain/PhoneNumber';
import { useThreads, useConversationThread, useTranslateAll } from '@/hooks/useThreads';
import { formatPhone } from '@/lib/format';

// ============================================================================
// ConversationsPage — WhatsApp-style two-pane view: whitelisted contacts on
// the left (sorted by last message), chat bubbles for the selected thread on
// the right, with a "Translate all" action for the open conversation.
// ============================================================================

export function ConversationsPage() {
  const { data: threads, isLoading: threadsLoading } = useThreads();
  const [selected, setSelected] = useState<string | null>(null);
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Default to the most-recent conversation once the list loads.
  useEffect(() => {
    if (!selected && threads && threads.length > 0) {
      setSelected(threads[0].phone_number);
    }
  }, [threads, selected]);

  const { data: messages, isLoading: threadLoading } = useConversationThread(selected);
  const translateAll = useTranslateAll();

  const ordered = useMemo(
    () =>
      [...(messages ?? [])].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      ),
    [messages],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [selected, ordered.length]);

  const untranslatedCount = ordered.filter(
    (m) => m.translation_status !== 'done' && !!(m.body?.trim() || m.transcript?.trim()),
  ).length;

  const selectedThread = threads?.find((t) => t.phone_number === selected);
  const name = selectedThread ? selectedThread.label || formatPhone(selectedThread.phone_number) : '';

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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Conversations" subtitle="Full two-sided threads for whitelisted contacts." />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-r border-line-strong bg-surface">
          <ConversationList
            threads={threads ?? []}
            selected={selected}
            onSelect={setSelected}
            loading={threadsLoading}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-bg">
          {!selected ? (
            <EmptyState
              icon="messageSquare"
              title="No conversation selected"
              description="Pick a contact from the list."
            />
          ) : (
            <>
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line-strong bg-surface px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <Avatar personName={name} size="sm" />
                  <div className="flex flex-col">
                    <span className="text-[14px] font-bold text-fg">{name}</span>
                    <PhoneNumber value={selected} fontSize="11.5px" />
                  </div>
                </div>
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

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
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
                      <MessageBubble key={m.id} message={m} />
                    ))}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
