# Component & API contract reference

Everything below already EXISTS and is typechecked. Import by path with the `@/`
alias. Compose these — do not reimplement them. Props marked `(req)` are required.

## UI primitives — `@/components/ui/<Name>`

| Component | Key props |
|---|---|
| `Icon` | `name`(req `IconName`), `size?`, `color?`, `className?` |
| `Button` | `label?`/`children?`, `variant?`:'primary'\|'secondary'\|'ghost'\|'danger', `size?`:'sm'\|'md'\|'lg', `loading?`, `icon?:IconName`, `iconTrailing?`, `block?`, `onClick?`, `disabled?` |
| `IconButton` | `icon`(req), `ariaLabel`(req), `variant?`:'ghost'\|'solid'\|'danger', `size?`, `loading?`, `onClick?`, `disabled?` |
| `Spinner` | `size?`:'sm'\|'md'\|'lg', `className?` |
| `Card` | `title?`, `subtitle?`, `bodyText?`, `children?`, `actionLabel?`, `onAction?`, `footerText?`, `padding?`:'none'\|'sm'\|'md' |
| `Input` | `label?`, `value?`, `placeholder?`, `disabled?`, `required?`, `error?`, `hint?`, `mono?`, `icon?:IconName`, `onChange?(value:string)`, `multiline?`, `rows?`, `type?`, `onKeyDown?` |
| `Select` | `label?`, `value?`, `options`(req `{value,label}[]`), `onChange?(value)`, `disabled?`, `error?`, `aria-label?` — every option needs a non-empty `value` |
| `Checkbox` | `checked?`, `disabled?`, `label?`, `onChange?(checked:boolean)` |
| `Switch` | `checked?`, `disabled?`, `label?`, `onChange?(checked:boolean)` |
| `Badge` | `label?`/`children?`, `tone?`:Tone, `icon?:IconName` |
| `StatusPill` | `label?`/`children?`, `tone?`:Tone, `pulse?` |
| `StatCard` | `label?`, `value?`, `delta?`(green if starts with "+"), `icon?:IconName`, `loading?` |
| `Table<Row>` | `columns`(req), `rows`(req), `rowKey?`, `density?`, `sortKey?`, `sortDir?`, `onSort?`, `showPagination?`, `page?`, `pageSize?`, `totalRows?`, `onPageChange?`, `maxHeight?` |
| `EmptyState` | `icon?`, `title?`, `description?`, `actionLabel?`, `onAction?` |
| `Skeleton` | `width?`, `height?`, `radius?` |
| `Tabs` | `tabs`(req `{value,label}[]`), `active?`, `onChange?(value)` |
| `Tooltip` | `triggerLabel?`/`children?`, `text`(req), `side?`, `forceOpen?` |
| `Modal` | `open`(req), `title?`, `description?`, `children?`, `icon?`, `iconTone?`, `size?`, `primaryLabel?`, `primaryVariant?`, `secondaryLabel?`, `loading?`, `hideFooter?`, `onPrimary?`, `onSecondary?`, `onClose?` |
| `ConfirmDialog` | `open`(req), `title?`, `description?`, `confirmLabel?`, `cancelLabel?`, `loading?`, `onConfirm?`, `onCancel?` |
| `Toast` | `tone`, `title`(req), `description?`, `onClose?` — for app toasts use `useToast()` (below) |
| `Avatar` | `personName?`, `size?`:'sm'\|'md'\|'lg' |
| `CodeInline` | `text?`/`children?` |
| `CopyButton` | `value`(req string), `label?` |

`Tone` = `'neutral'|'success'|'warning'|'danger'|'info'` (from `@/lib/tones`).
`IconName` (from `@/components/ui/Icon`) includes: wifi, shield, messageSquare, filter,
plug, layoutGrid, plus, trash, copy, search, externalLink, refreshCw, lock, users,
check, x, chevronLeft/Right, qrcode, alertCircle, alertTriangle, download, moon, sun, etc.

### Toast usage
```tsx
import { useToast } from '@/components/ui/Toast';
const { toast } = useToast();
toast({ tone: 'success', title: 'Number whitelisted', description: '…' });
```
`ToastProvider` is already mounted at the app root — just call `useToast()`.

## Domain components — `@/components/domain/<Name>`

| Component | Key props |
|---|---|
| `PhoneNumber` | `value`(req), `fontSize?` |
| `RelativeTime` | `timestamp`(req), `fontSize?` |
| `MessageTypeBadge` | `messageType`(req `MessageType`) |
| `ConnectionStatusBadge` | `state`(req `ConnectionState`), `label?` |
| `QrLoginCard` | `state`(req), `qrDataUrl?`, `cooldownActive?`, `cooldownSeconds?`, `errorMessage?`, `onRetry?` |
| `AccountCard` | `pushname?`, `wid?`, `readyAt?` |
| `IgnoredCountersPanel` | `counts?:Record<string,number>`, `total?`, `loading?` |
| `SafetyFlags` | `outboundEnabled?`, `monitorGroups?` |
| `AddNumberForm` | `submitting?`, `onAdd?({number,label?})` (manages its own field state + validation) |
| `WhitelistTable` | `rows?:WhitelistEntry[]`, `loading?`, `deletingId?`, `onDelete?(id)` — shows its own delete ConfirmDialog; `onDelete` receives the row **id** |
| `MessageRow` | `senderName?`, `senderNumber`(req), `body?`, `messageType?`, `timestamp?`, `onClick?` |
| `MessageList` | `rows?:StoredMessage[]`, `loading?`, `onOpenMessage?(msg)` (renders loading & empty states itself) |
| `MessageFilters` | `search?`, `numberFilter?`, `typeFilter?`, `numbers?:{phone_number,label?}[]`, `onSearchChange`, `onNumberChange`, `onTypeChange` |
| `MessageDetail` | `open`(req), `message?:StoredMessage`, `onClose?` (right-side drawer, portal) |

## Layout — `@/components/layout/<Name>`

- `AppLayout` — the shell (Sidebar + TopBar + `<Outlet/>`). Pages render INSIDE it.
- `PageHeader` — `title`(req), `subtitle?`, `badgeLabel?`, `badgeTone?`, `actions?:ReactNode`.
- `Sidebar`, `TopBar` — already wired; pages don't use these directly.
- `NAV_ITEMS`, `activeKeyForPath` from `@/components/layout/nav`.

## Hooks — `@/hooks/*`

- `useStatus(pollMs=5000)` → `{ data: StatusData }` — `{ state, pushname, wid, readyAt, whitelistCount, outboundEnabled, monitorGroups, ignored:Record<string,number>, ignoredTotal }`
- `useQr(enabled=true)` → `{ data: QrData }` — `{ state, qr, dataUrl }`, auto-polls until connected
- `useWhitelist()` → `{ data: WhitelistEntry[] }`
- `useAddWhitelist()` → mutation, call `.mutate({ number, label })`
- `useRemoveWhitelist()` → mutation, call `.mutate(phone_number)` — **takes the phone_number string, NOT the id** (backend `DELETE /whitelist/:number`)
- `useMessages({limit,offset})` → `{ data: StoredMessage[] }`
- `useMessagesByNumber(number, {limit,offset})` → `{ data: StoredMessage[] }` (normalizes the number; disabled for 'all'/empty)

All are React Query results: use `.data`, `.isLoading`, `.isPending` (mutations), `.refetch`.

## Helpers / types

- `@/lib/format`: `formatPhone`, `relativeTime`, `formatDateTime`, `initials`, `normalizeNumber`
- `@/lib/cn`: `cn(...)`
- `@/types`: `ConnectionState`, `MessageType`, `StoredMessage`, `WhitelistEntry`, `StatusData`, `QrData`

## Routing

Pages render inside `AppLayout`'s `<Outlet/>`. Routes:
`/`=Overview(dashboard), `/connection`=Connection, `/whitelist`=Whitelist, `/messages`=Messages.
Use `useNavigate()` from `react-router-dom` for in-app links (e.g. "View all" → `/messages`).

A page = `<><PageHeader … /><div className="flex flex-col gap-… p-7">…</div></>`.
Do NOT render Sidebar/TopBar — the shell already does.
