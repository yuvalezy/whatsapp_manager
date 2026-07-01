# Build: ConnectionPage → `src/pages/ConnectionPage.tsx` (export `function ConnectionPage()`)

The connection / linking screen. Renders inside `AppLayout` (do NOT render Sidebar/TopBar).

## Data
```tsx
const { data: status } = useStatus();          // @/hooks/useStatus
const { data: qr } = useQr();                  // @/hooks/useQr
const state = status?.state ?? 'INITIALIZING';
```

## Structure
```tsx
return (
  <>
    <PageHeader
      title="Connection"
      subtitle="Link this dashboard to WhatsApp Web. It is read-only — it can never send messages."
    />
    <div className="flex flex-col items-start gap-[22px] p-7">
      {state === 'READY' ? (
        <>
          <ConnectionStatusBadge state="READY" />
          <AccountCard pushname={status?.pushname} wid={status?.wid} readyAt={status?.readyAt} />
        </>
      ) : (
        <QrLoginCard
          state={state}
          qrDataUrl={qr?.dataUrl ?? undefined}
          onRetry={() => window.location.reload()}
        />
      )}
    </div>
  </>
);
```

## Notes
- Do NOT include the design mock's "Preview state" tabs — that was a design-only affordance. Show the real live `state`.
- `QrLoginCard` already renders the correct sub-state (spinner / QR + steps / success / reconnecting / failure) from `state`.
- Imports: `PageHeader` from `@/components/layout/PageHeader`; `QrLoginCard`, `AccountCard`, `ConnectionStatusBadge` from `@/components/domain/*`.
