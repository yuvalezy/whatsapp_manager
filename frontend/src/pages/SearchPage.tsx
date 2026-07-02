import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { IconButton } from '@/components/ui/IconButton';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { HighlightText } from '@/components/ui/HighlightText';
import { MessageTypeBadge } from '@/components/domain/MessageTypeBadge';
import { RelativeTime } from '@/components/domain/RelativeTime';
import { useMessageSearch, type MessageSearchFilters } from '@/hooks/useMessageSearch';
import { formatPhone } from '@/lib/format';
import type { StoredMessage } from '@/types';

// ============================================================================
// SearchPage — global full-text search across every captured message (body,
// transcript, translated_body). Debounced query + direction/type filters +
// paging; each hit shows the matched snippet with the term highlighted and
// clicks through to that conversation.
// ============================================================================

const PAGE_SIZE = 20;

const DIRECTION_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Any direction' },
  { value: 'inbound', label: 'Received' },
  { value: 'outbound', label: 'Sent' },
];

const TYPE_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All types' },
  { value: 'chat', label: 'Text' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'ptt', label: 'Voice note' },
  { value: 'document', label: 'Document' },
  { value: 'sticker', label: 'Sticker' },
  { value: 'location', label: 'Location' },
  { value: 'vcard', label: 'Contact' },
];

export function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [direction, setDirection] = useState('all');
  const [type, setType] = useState('all');
  const [offset, setOffset] = useState(0);

  // Debounce so we don't fire a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Any query/filter change resets to the first page.
  useEffect(() => {
    setOffset(0);
  }, [debounced, direction, type]);

  const filters: MessageSearchFilters = useMemo(
    () => ({
      direction: direction === 'all' ? undefined : (direction as 'inbound' | 'outbound'),
      type: type === 'all' ? undefined : type,
    }),
    [direction, type],
  );

  const { data, isLoading, isFetching, isError, refetch } = useMessageSearch(debounced, filters, {
    limit: PAGE_SIZE,
    offset,
  });

  const term = debounced.trim();
  const rows = data?.rows ?? [];
  const total = data?.paging.total ?? 0;
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, total);

  const openThread = (m: StoredMessage) => {
    const threadId = m.contact_number ?? m.sender_number;
    navigate(`/conversations?number=${encodeURIComponent(threadId)}`);
  };

  return (
    <>
      <PageHeader
        title="Search"
        subtitle="Full-text search across message bodies, transcripts, and translations."
      />
      <div className="flex flex-col gap-4 p-7">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-[320px] max-w-full">
            <Input
              type="search"
              icon="search"
              placeholder="Search all messages…"
              value={query}
              autoFocus
              onChange={setQuery}
            />
          </div>
          <div className="w-[170px]">
            <Select
              aria-label="Filter by direction"
              value={direction}
              options={DIRECTION_OPTIONS}
              onChange={setDirection}
            />
          </div>
          <div className="w-[170px]">
            <Select
              aria-label="Filter by type"
              value={type}
              options={TYPE_OPTIONS}
              onChange={setType}
            />
          </div>
          {isFetching && term.length > 0 && <Spinner size="sm" className="text-fg-muted" />}
        </div>

        {term.length === 0 ? (
          <EmptyState
            icon="search"
            title="Search your captured messages"
            description="Type a word or phrase to find it across every conversation, transcript, and translation."
          />
        ) : isError ? (
          <ErrorState
            title="Search failed"
            description="The search request could not be completed."
            onRetry={() => void refetch()}
          />
        ) : isLoading ? (
          <div className="flex items-center gap-2 p-5 text-[13px] text-fg-muted">
            <Spinner size="sm" /> Searching…
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="search"
            title="No matches"
            description={`Nothing matched “${term}”. Try different words or clear the filters.`}
          />
        ) : (
          <>
            <span className="text-[12.5px] text-fg-muted">
              {total.toLocaleString()} {total === 1 ? 'match' : 'matches'} for “{term}”
            </span>
            <div className="flex flex-col overflow-hidden rounded-wm-card border border-line-strong bg-surface">
              {rows.map((m) => (
                <SearchResultItem key={m.id} message={m} term={term} onOpen={() => openThread(m)} />
              ))}
            </div>

            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-fg-muted">
                  {rangeStart}–{rangeEnd} of {total.toLocaleString()}
                </span>
                <div className="flex gap-1.5">
                  <IconButton
                    icon="chevronLeft"
                    size="sm"
                    variant="solid"
                    ariaLabel="Previous page"
                    disabled={offset <= 0}
                    onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                  />
                  <IconButton
                    icon="chevronRight"
                    size="sm"
                    variant="solid"
                    ariaLabel="Next page"
                    disabled={rangeEnd >= total}
                    onClick={() => setOffset((o) => o + PAGE_SIZE)}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

/** Which field the match came from, windowed around the first matching token. */
function snippetFor(m: StoredMessage, term: string): { label: string | null; text: string } {
  const candidates: { label: string | null; text: string | null | undefined }[] = [
    { label: null, text: m.body },
    { label: 'Transcript', text: m.transcript },
    { label: 'Translation', text: m.translated_body },
  ];
  const tokens = term.toLowerCase().split(/\s+/).filter(Boolean);
  const containsToken = (text: string) => {
    const lc = text.toLowerCase();
    return tokens.some((t) => lc.includes(t));
  };
  const hit = candidates.find((c) => c.text?.trim() && containsToken(c.text));
  const chosen = hit ?? candidates.find((c) => c.text?.trim());
  return { label: chosen?.label ?? null, text: windowedSnippet(chosen?.text ?? '', term) };
}

/** Collapse whitespace and window ~90 chars around the first matching token. */
function windowedSnippet(text: string, term: string, radius = 90): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const tokens = term.toLowerCase().split(/\s+/).filter(Boolean);
  const lc = clean.toLowerCase();
  let idx = -1;
  for (const t of tokens) {
    const i = lc.indexOf(t);
    if (i !== -1 && (idx === -1 || i < idx)) idx = i;
  }
  if (idx === -1) return clean.length > radius * 2 ? `${clean.slice(0, radius * 2)}…` : clean;
  const start = Math.max(0, idx - radius);
  const end = Math.min(clean.length, idx + radius);
  return `${start > 0 ? '…' : ''}${clean.slice(start, end)}${end < clean.length ? '…' : ''}`;
}

function SearchResultItem({
  message: m,
  term,
  onOpen,
}: {
  message: StoredMessage;
  term: string;
  onOpen: () => void;
}) {
  const isOutbound = m.direction === 'outbound';
  const name = m.sender_name || formatPhone(m.contact_number ?? m.sender_number) || 'Unknown';
  const snippet = snippetFor(m, term);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-start gap-3 border-b border-line px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-2"
    >
      <Avatar personName={name} size="md" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-bold text-fg">{name}</span>
          <Badge tone={isOutbound ? 'neutral' : 'info'} label={isOutbound ? 'Sent' : 'Received'} />
          {m.message_type !== 'chat' && <MessageTypeBadge messageType={m.message_type} />}
          <div className="flex-1" />
          <RelativeTime timestamp={m.timestamp} fontSize="11.5px" className="shrink-0" />
        </div>
        <div className="text-[13px] leading-relaxed text-fg-secondary">
          {snippet.label && (
            <span className="mr-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-fg-muted">
              {snippet.label}
            </span>
          )}
          <HighlightText text={snippet.text} term={term} />
        </div>
      </div>
      <Icon name="chevronRight" size={16} className="mt-1 shrink-0 text-fg-muted" />
    </button>
  );
}
