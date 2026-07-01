# Build: WhitelistPage → `src/pages/WhitelistPage.tsx` (export `function WhitelistPage()`)

Manage the allow-list: add form + table with delete. Inside `AppLayout`.

## Data & state
```tsx
const { data: whitelist, isLoading } = useWhitelist();  // @/hooks/useWhitelist
const add = useAddWhitelist();                          // @/hooks/useWhitelist
const remove = useRemoveWhitelist();                    // @/hooks/useWhitelist
const { toast } = useToast();                           // @/components/ui/Toast
const [removingId, setRemovingId] = useState<string | number | null>(null);
```
Import `formatPhone` from `@/lib/format`.

## Structure
1. `<PageHeader title="Whitelist" subtitle="Only inbound messages from these numbers are ever captured. Everything else is counted and dropped." />`
2. `<div className="flex flex-col gap-[22px] p-7">`
3. Add form:
```tsx
<AddNumberForm
  submitting={add.isPending}
  onAdd={({ number, label }) =>
    add.mutate(
      { number, label },
      {
        onSuccess: (entry) =>
          toast({ tone: 'success', title: 'Number whitelisted', description: `${formatPhone(entry.phone_number)} will now be monitored.` }),
        onError: (e) =>
          toast({ tone: 'danger', title: 'Could not add number', description: e instanceof Error ? e.message : 'Please try again.' }),
      },
    )
  }
/>
```
4. Table:
```tsx
<WhitelistTable
  rows={whitelist ?? []}
  loading={isLoading}
  deletingId={removingId}
  onDelete={(id) => {
    const row = (whitelist ?? []).find((r) => r.id === id);
    if (!row) return;
    setRemovingId(id);
    remove.mutate(row.phone_number, {
      onSuccess: () => toast({ tone: 'success', title: 'Number removed' }),
      onError: (e) => toast({ tone: 'danger', title: 'Could not remove number', description: e instanceof Error ? e.message : 'Please try again.' }),
      onSettled: () => setRemovingId(null),
    });
  }}
/>
```

## Notes
- `useRemoveWhitelist().mutate(...)` takes the **phone_number string**, not the id. `WhitelistTable`'s `onDelete` gives you the row **id**, so look up the row and pass `row.phone_number` (as shown).
- `WhitelistTable` renders its own delete-confirmation dialog and its own loading/empty states.

## Imports
`PageHeader` (@/components/layout/PageHeader); `AddNumberForm`, `WhitelistTable` (@/components/domain/*);
`useWhitelist`, `useAddWhitelist`, `useRemoveWhitelist` (@/hooks/useWhitelist); `useToast` (@/components/ui/Toast); `formatPhone` (@/lib/format).
