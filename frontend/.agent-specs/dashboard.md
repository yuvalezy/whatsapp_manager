# Build: DashboardPage → `src/pages/DashboardPage.tsx` (export `function DashboardPage()`)

The Overview screen. Renders inside `AppLayout`.

## Data & state
```tsx
const { data: status } = useStatus();                    // @/hooks/useStatus
const { data: messages, isLoading } = useMessages({ limit: 6 }); // @/hooks/useMessages
const navigate = useNavigate();                          // react-router-dom
const [selected, setSelected] = useState<StoredMessage | null>(null);
const [open, setOpen] = useState(false);
```

Map connection state → a short label for the stat card:
`READY→'Connected'`, `DISCONNECTED→'Reconnecting'`, `QR_READY→'Scan QR'`,
`AUTHENTICATED→'Linking'`, `INITIALIZING→'Starting'`, `AUTH_FAILURE→'Auth failed'`, `ERROR→'Error'`.

## Structure
1. `<PageHeader title="Overview" subtitle="Connection health, whitelist, and recent captures at a glance." />`
2. Content wrapper: `<div className="flex flex-col gap-5 p-7">`
3. Stats grid — `<div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">` with four `StatCard`:
   - `label="Connection"` `value={connectionLabel}` `icon="wifi"` `loading={!status}`
   - `label="Whitelisted numbers"` `value={String(status?.whitelistCount ?? 0)}` `icon="shield"` `loading={!status}`
   - `label="Messages captured"` `value={String(messages?.length ?? 0)}` `icon="messageSquare"` `loading={isLoading}`
   - `label="Ignored (dropped)"` `value={(status?.ignoredTotal ?? 0).toLocaleString()}` `icon="filter"` `loading={!status}`
4. Mid grid — `<div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">`:
   - `<AccountCard pushname={status?.pushname} wid={status?.wid} readyAt={status?.readyAt} />`
   - `<IgnoredCountersPanel counts={status?.ignored} total={status?.ignoredTotal} loading={!status} />`
   - `<SafetyFlags outboundEnabled={status?.outboundEnabled} monitorGroups={status?.monitorGroups} />`
5. Recent messages section:
```tsx
<div className="flex flex-col gap-3.5 rounded-wm-card border border-line-strong bg-surface p-[18px] shadow-wm-card">
  <div className="flex items-start justify-between gap-3">
    <div>
      <div className="text-[15px] font-bold text-fg">Recent messages</div>
      <div className="mt-0.5 text-[12.5px] text-fg-secondary">Latest inbound captures from whitelisted numbers</div>
    </div>
    <Button variant="ghost" size="sm" icon="externalLink" label="View all" onClick={() => navigate('/messages')} />
  </div>
  <MessageList rows={messages ?? []} loading={isLoading} onOpenMessage={(m) => { setSelected(m); setOpen(true); }} />
</div>
```
6. Drawer: `<MessageDetail open={open} message={selected ?? undefined} onClose={() => setOpen(false)} />`

## Imports
`PageHeader` (@/components/layout/PageHeader); `StatCard`, `Button` (@/components/ui/*);
`AccountCard`, `IgnoredCountersPanel`, `SafetyFlags`, `MessageList`, `MessageDetail` (@/components/domain/*);
`useStatus`, `useMessages` (@/hooks/*); `StoredMessage` (@/types); `useNavigate` (react-router-dom).
