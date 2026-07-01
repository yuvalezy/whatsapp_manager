import { useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { IconButton } from '@/components/ui/IconButton';
import { MessageFilters } from '@/components/domain/MessageFilters';
import { MessageList } from '@/components/domain/MessageList';
import { MessageDetail } from '@/components/domain/MessageDetail';
import { useWhitelist } from '@/hooks/useWhitelist';
import { useMessages } from '@/hooks/useMessages';
import { normalizeNumber } from '@/lib/format';
import type { StoredMessage } from '@/types';

const PAGE_SIZE = 15;

export function MessagesPage() {
  const { data: whitelist } = useWhitelist();
  const { data: messages, isLoading } = useMessages({ limit: 500 });

  const [search, setSearch] = useState('');
  const [numberFilter, setNumberFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<StoredMessage | null>(null);
  const [open, setOpen] = useState(false);

  const all = messages ?? [];
  const filtered = all.filter(
    (m) =>
      (numberFilter === 'all' || normalizeNumber(m.sender_number) === normalizeNumber(numberFilter)) &&
      (typeFilter === 'all' || m.message_type === typeFilter) &&
      (!search || (m.body ?? '').toLowerCase().includes(search.toLowerCase())),
  );

  const total = filtered.length;
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);
  const rangeStart = total === 0 ? 0 : start + 1;
  const rangeEnd = Math.min(start + PAGE_SIZE, total);

  return (
    <>
      <PageHeader title="Messages" subtitle="Captured inbound messages from whitelisted numbers only." />
      <div className="flex flex-col gap-4 p-7">
        <MessageFilters
          search={search}
          numberFilter={numberFilter}
          typeFilter={typeFilter}
          numbers={(whitelist ?? []).map((w) => ({ phone_number: w.phone_number, label: w.label }))}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          onNumberChange={(v) => {
            setNumberFilter(v);
            setPage(1);
          }}
          onTypeChange={(v) => {
            setTypeFilter(v);
            setPage(1);
          }}
        />

        <MessageList
          rows={pageItems}
          loading={isLoading}
          onOpenMessage={(m) => {
            setSelected(m);
            setOpen(true);
          }}
        />

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-fg-muted">
              {rangeStart}–{rangeEnd} of {total}
            </span>
            <div className="flex gap-1.5">
              <IconButton
                icon="chevronLeft"
                size="sm"
                variant="solid"
                ariaLabel="Previous page"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              />
              <IconButton
                icon="chevronRight"
                size="sm"
                variant="solid"
                ariaLabel="Next page"
                disabled={rangeEnd >= total}
                onClick={() => setPage((p) => p + 1)}
              />
            </div>
          </div>
        )}

        <MessageDetail open={open} message={selected ?? undefined} onClose={() => setOpen(false)} />
      </div>
    </>
  );
}
