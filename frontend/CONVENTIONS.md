# Frontend build conventions — READ THIS FIRST

You are porting a **Claude Design** component kit (`*.dc.html` files) into a real
**Vite + React 19 + TypeScript + Tailwind** app. Match the design faithfully but
write idiomatic React. The scaffold, design tokens, and several golden components
already exist — **follow their patterns exactly.**

## Where things live

```
frontend/src/
  design-src/<Name>.dc.html   # the design source you are porting (READ, don't edit)
  components/ui/              # primitives (Button, Card, Input, Badge, …)
  components/domain/          # domain components (WhitelistTable, MessageList, …)
  components/layout/          # Sidebar, TopBar, PageHeader, AppLayout
  pages/                     # Dashboard, Login, Messages, Whitelist, Gallery
  lib/                       # api.ts, cn.ts, format.ts, queryClient.ts
  hooks/                     # React Query hooks
  theme/ThemeProvider.tsx    # theme context (dark default)
  types/index.ts             # API types
```

One component per file, named export, `PascalCase.tsx`. Co-locate the prop
interface in the same file and export it (`export interface ButtonProps`).

## Golden examples — read these before writing anything

- `src/components/ui/Icon.tsx` — the icon set + `IconName` type. **Never reimplement icons**; import `{ Icon }` and use `name="..."`. If a glyph is missing, add it to `Icon.tsx`.
- `src/components/ui/Button.tsx` — variants × sizes, loading, icon.
- `src/components/ui/Card.tsx` — surface container, composition via `children`.
- `src/components/ui/Input.tsx` — label/hint/error, controlled `onChange(value)`.
- `src/components/ui/Spinner.tsx` — sizes, inherits `currentColor`.

## The #1 translation rule: DROP the `theme` prop

The `.dc.html` files pass an explicit `theme="dark|light"` prop and switch a
`PALETTE` object by hand. **We do not.** Theme is global via CSS variables +
`data-theme` on `<html>` (see `ThemeProvider`). So:

- **Delete every `theme` prop.** Never accept or pass it.
- Replace `PALETTE[theme].xxx` hex values with the **semantic Tailwind classes**
  below, which resolve to the right value per theme automatically.
- `on-click` → `onClick`, `on-change` → `onChange`, `on-close` → `onClose`, etc.
- The `data-props` JSON block in each `.dc.html` is the **exact prop contract** —
  use its names, `tsType`s, and `options` for your TypeScript interface (minus `theme`).
- Keep exact pixel dimensions (heights, padding, radii, font-size, gap) from
  `renderVals()`. Use Tailwind's arbitrary values when there's no scale token,
  e.g. `h-[38px]`, `text-[13.5px]`, `rounded-[10px]`.

## Semantic color classes (map design hex → these)

| Design role | Tailwind class | Notes |
|---|---|---|
| page background `#0D1310` | `bg-bg` | |
| nav/sidebar bg `#0F1512` | `bg-nav` | |
| card/surface `#151B18` | `bg-surface` | |
| raised surface `#1C231F` | `bg-surface-2` | inputs, code, hover |
| border `#232B26` | `border-line` | |
| stronger border `#2A332D` | `border-line-strong` | cards, inputs |
| primary text `#ECF2EE` | `text-fg` | |
| secondary text `#A9B6AE` | `text-fg-secondary` | |
| muted text `#6B776F` | `text-fg-muted` | |
| brand `#25D366` | `bg-primary` / `text-primary` | on-primary text = `text-primary-fg` |
| brand hover | `hover:bg-primary-hover` | |
| brand soft bg | `bg-primary-soft` | |
| deep accent `#128C7E` | `bg-accent` / `text-accent` | |
| code bg / fg | `bg-code-bg` / `text-code-fg` | |

**Semantic tones** — each has base / soft bg / on-soft text:
`success`, `warning`, `danger`, `info`, plus `neutral` (soft + fg only).
e.g. a success badge: `bg-success-soft text-success-fg`; a solid danger button
border: `border-danger`. Tone → role mapping used across the kit:

- `success` = connected / active / good (green)
- `warning` = reconnecting / cooldown (amber)
- `danger` = error / blocked / destructive (red)
- `info` = neutral informational (blue)
- `neutral` = default grey chip

## Radii, fonts, shadows, animation (Tailwind tokens already defined)

- Radii: `rounded-wm-sm` (9px), `rounded-wm` (14px), `rounded-wm-card` (16px), `rounded-pill` (999px). Buttons use `rounded-[10px]`.
- Fonts: `font-sans` (Manrope, default), `font-mono` (JetBrains Mono — phones/IDs/code).
- Shadows: `shadow-wm-card`, `shadow-wm-pop` (overlays).
- Animation: `animate-wm-spin`, `animate-wm-pulse`, `animate-wm-fade-in`, `animate-wm-scale-in`, `animate-wm-slide-in`.
- Focus: add class `wm-focus-ring` to interactive elements for the standard ring.

## Type scale (from Foundations)

- Page/stat value: `text-[28px] font-extrabold`
- Page title: `text-[22px] font-extrabold`
- Card/section title: `text-[15px] font-bold`
- Body: `text-[13.5px]` (this is the base; often just default)
- Group/eyebrow label: `text-[11.5px] font-bold uppercase tracking-wider text-fg-muted`
- Mono phone/IDs: `font-mono text-[13.5px] font-medium`

## Utilities to reuse (don't duplicate)

- `cn(...)` from `@/lib/cn` for className composition (always use it).
- `formatPhone`, `relativeTime`, `formatDateTime`, `initials`, `hueFromString`, `normalizeNumber` from `@/lib/format`.
- Types from `@/types` (`ConnectionState`, `MessageType`, `StoredMessage`, `WhitelistEntry`, `StatusData`, …).
- Import siblings with the `@/` alias, e.g. `import { Badge } from '@/components/ui/Badge'`.

## Interaction / state

- Controlled inputs: `value` + `onChange(nextValue: string)` (not the raw event).
- Overlays (Modal, ConfirmDialog, MessageDetail drawer, Toast): render nothing
  when `open` is false; use `createPortal` to `document.body`; close on Escape and
  backdrop click; lock scroll while open. Animate in with `animate-wm-scale-in`
  (modal) / `animate-wm-slide-in` (drawer).
- Accessibility: real `<button>`/`<label>`/`<input>`; `aria-*` where the DC source
  has it; keyboard operable (Enter/Space/Escape); `focus-visible` rings.

## Do NOT

- Do not add new npm dependencies.
- Do not use inline `style={{}}` for colors — use the semantic classes. (Inline
  style is OK only for genuinely dynamic values like a computed width %, an avatar
  hue, or a QR image data-URL.)
- Do not create `index.ts` barrels unless asked — import components by path.
- Do not touch files outside your assigned list.
