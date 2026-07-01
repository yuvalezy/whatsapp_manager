# WhatsApp Manager — Frontend

React dashboard for the [WhatsApp Manager](../README.md) monitoring service, built
from the "WhatsApp Manager Dashboard" Claude Design system.

**Stack:** Vite + React 19 + TypeScript (strict) + Tailwind (CSS-variable theming) +
React Query + React Router.

## Run (dev)

```bash
npm install
npm run dev          # http://localhost:5173
```

The backend is expected on `http://localhost:3000`. Vite proxies the API routes
(`/status`, `/qr`, `/whitelist`, `/messages`, `/outbound`, `/health`) to it, so there
are no CORS concerns. Override the target with `VITE_API_TARGET`, or point the client
at an absolute backend with `VITE_API_BASE`. If the backend has `API_KEY` set, provide
`VITE_API_KEY` (sent as `x-api-key`).

```bash
npm run build        # tsc -b && vite build → dist/
npm run preview      # serve the production build
npm run typecheck    # tsc -b, no emit
```

## Routes

| Path | Screen |
| --- | --- |
| `/` | Overview (connection health, whitelist size, ignored counters, recent messages) |
| `/connection` | Link WhatsApp (QR / linking / account) |
| `/whitelist` | Manage the allow-list (add / remove) |
| `/messages` | Browse captured messages (filter + detail drawer) |
| `/gallery` | **Component gallery** — the full design-system showcase |

## Structure

```
src/
  components/ui/         # 23 primitives (Button, Input, Table, Modal, Toast, …)
  components/domain/     # 14 domain components (QrLoginCard, WhitelistTable, MessageList, …)
  components/layout/     # Sidebar, TopBar, PageHeader, AppLayout, nav
  pages/                 # Dashboard, Connection, Whitelist, Messages, Gallery
  hooks/                 # React Query hooks (useStatus, useQr, useWhitelist, useMessages)
  lib/                   # api client, formatters, cn, tones, queryClient
  theme/                 # ThemeProvider (dark default, persisted to localStorage)
  types/                 # API types
  index.css              # design tokens (CSS variables, dark + light)
```

Design-system conventions live in [`CONVENTIONS.md`](./CONVENTIONS.md); a full
component/prop/hook contract is in [`COMPONENTS.md`](./COMPONENTS.md).

## Theming

Dark is the default. Every color is a CSS variable (`--wm-*`) defined for both themes
in `src/index.css` and exposed to Tailwind as semantic classes (`bg-surface`,
`text-fg`, `border-line`, `bg-primary`, tone `success|warning|danger|info`). The theme
toggles via `data-theme` on `<html>` and persists to `localStorage['wm-theme']`.
