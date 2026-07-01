# Build: MessagesPage → `src/pages/MessagesPage.tsx` (export `function MessagesPage()`)

Captured-messages browser with filters + pagination + detail drawer. Inside `AppLayout`.

## Data & state
```tsx
const { data: whitelist } = useWhitelist();                       // @/hooks/useWhitelist
const { data: messages, isLoading } = useMessages({ limit: 500 }); // @/hooks/useMessages
const [search, setSearch] = useState('');
const [numberFilter, setNumberFilter] = useState('all');
const [typeFilter, setTypeFilter] = useState('all');
const [page, setPage] = useState(1);
const [selected, setSelected] = useState<StoredMessage | null>(null);
const [open, setOpen] = useState(false);
const PAGE_SIZE = 15;
```

Import `normalizeNumber` from `@/lib/format`. Reset `page` to 1 whenever a filter changes.

## Client-side filtering
```tsx
const all = messages ?? [];
const filtered = all.filter((m) =>
  (numberFilter === 'all' || normalizeNumber(m.sender_number) === normalizeNumber(numberFilter)) &&
  (typeFilter === 'all' || m.message_type === typeFilter) &&
  (!search || (m.body ?? '').toLowerCase().includes(search.toLowerCase())),
);
const total = filtered.length;
const start = (page - 1) * PAGE_SIZE;
const pageItems = filtered.slice(start, start + PAGE_SIZE);
const rangeStart = total === 0 ? 0 : start + 1;
const rangeEnd = Math.min(start + PAGE_SIZE, total);
```

## Structure
1. `<PageHeader title="Messages" subtitle="Captured inbound messages from whitelisted numbers only." />`
2. `<div className="flex flex-col gap-4 p-7">`
3. Filters:
```tsx
<MessageFilters
  search={search}
  numberFilter={numberFilter}
  typeFilter={typeFilter}
  numbers={(whitelist ?? []).map((w) => ({ phone_number: w.phone_number, label: w.label }))}
  onSearchChange={(v) => { setSearch(v); setPage(1); }}
  onNumberChange={(v) => { setNumberFilter(v); setPage(1); }}
  onTypeChange={(v) => { setTypeFilter(v); setPage(1); }}
/>
```
4. `<MessageList rows={pageItems} loading={isLoading} onOpenMessage={(m) => { setSelected(m); setOpen(true); }} />`
5. Pagination (only when `total > PAGE_SIZE`):
```tsx
<div className="flex items-center justify-between">
  <span className="text-[12.5px] text-fg-muted">{rangeStart}–{rangeEnd} of {total}</span>
  <div className="flex gap-1.5">
    <IconButton icon="chevronLeft" size="sm" variant="solid" ariaLabel="Previous page" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} />
    <IconButton icon="chevronRight" size="sm" variant="solid" ariaLabel="Next page" disabled={rangeEnd >= total} onClick={() => setPage((p) => p + 1)} />
  </div>
</div>
```
6. `<MessageDetail open={open} message={selected ?? undefined} onClose={() => setOpen(false)} />`

## Imports
`PageHeader` (@/components/layout/PageHeader); `IconButton` (@/components/ui/IconButton);
`MessageFilters`, `MessageList`, `MessageDetail` (@/components/domain/*);
`useWhitelist`, `useMessages` (@/hooks/*); `normalizeNumber` (@/lib/format); `StoredMessage` (@/types).
