# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **personal** WhatsApp Web monitoring service. It logs into one WhatsApp account
via QR, captures **1:1 messages (both directions) with whitelisted numbers**, and
drops everything else (counting it, never storing content). It downloads media,
auto-transcribes audio (OpenAI), and translates on demand (DeepSeek) into a clean
Postgres surface for an external agent to read. Outbound *sending* is a hard-gated
scaffold, off by default. See `README.md` for the user-facing feature tour.

Two independent apps live in this repo, each with its own `package.json` and
`node_modules`:

- **Backend** — root: Node 20+ / Express 5 / TypeScript, talks to Postgres.
- **Frontend** — `frontend/`: Vite + React 19 + TypeScript (strict) + Tailwind + React Query.

## Commands

Backend (run from repo root):

| Command | Purpose |
| --- | --- |
| `npm run dev` | Watch-mode dev server via `tsx` (port 3000). Runs migrations on boot. |
| `npm run build` | `tsc` → `dist/`, then copies `*.sql` migrations into `dist/`. |
| `npm start` | Run the compiled `dist/app.js`. |
| `npm run migrate` | Run DB migrations only (standalone). |
| `npm run typecheck` | `tsc --noEmit`. **This is the lint/CI gate — there is no ESLint and no test suite.** |

Frontend (run from `frontend/`):

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server on :5173, proxies API prefixes to :3000. |
| `npm run build` | `tsc -b && vite build` → `frontend/dist/`. |
| `npm run typecheck` / `npm run lint` | Both are `tsc -b` — the only quality gate. |

There are **no automated tests** in either app. Verify changes with `typecheck`
and by exercising the REST endpoints (see README's curl walkthrough) or the UI.

A running Postgres is required for the backend to boot. `.env.example` defaults to
a local instance; `docker compose up --build` brings up Postgres + app together.
Migrations are forward-only and run automatically on every boot (idempotent).

## Backend architecture

The whole point of the design is the **`MessageRouter` seam**: WhatsApp ingestion
is decoupled from every downstream system through one interface.

```
whatsapp-web.js Client (client.ts, singleton facade)
  └─ events.ts   ── connection lifecycle + the whitelist POLICY (handleIncoming)
        │ builds a RoutableMessage for allowed 1:1 senders only
        ▼
  router/message-router.ts  ── MessageRouter interface
        ├─ StorageMessageRouter → messageService.save() → Postgres `messages`
        └─ (future webhook / CRM / AI routers compose into CompositeMessageRouter)
```

Ingestion code (`events.ts`) only ever calls `router.route()`. To add a downstream
integration (webhook, AI, CRM), implement `MessageRouter` and add it to the
`CompositeMessageRouter` array in `message-router.ts` — **do not touch the WhatsApp
layer.** Composite fan-out uses `Promise.allSettled`, so a flaky router can't break
persistence.

Key structural conventions:

- **Services are singletons** exported as pre-built instances (`whatsappService`,
  `whitelistService`, `messageService`, `ignoredStats`). Import the instance, don't
  `new` them.
- **SQL lives only inside the service that owns the table.** Routes and the WhatsApp
  layer call service methods; they never call `db/query` directly. Follow this DRY
  boundary — reuse/extend the owning service instead of writing ad-hoc queries
  elsewhere.
- **DB access** goes through `db/index.ts`: `query()` for one-shots, `withClient()`
  for transactions (both use the shared `pool`). Migrations are plain numbered
  `*.sql` files in `src/db/migrations/`, applied in lexical order and tracked in
  `schema_migrations`.
- **Config** is validated once in `config/env.ts` via zod; import `{ env }`. Feature
  flags use the custom `boolFlag` helper, **not** `z.coerce.boolean()` (which treats
  `"false"` as `true`). `DATABASE_URL` wins over discrete `PG*` vars.
- **HTTP response envelope:** most endpoints return `{ data, paging? }`; `/health`
  is bare. The frontend `api.ts` unwraps `data` automatically — keep new endpoints
  consistent with this shape.
- **Auth:** optional `apiKeyGuard` (in `app.ts`) protects everything except
  `/health` when `API_KEY` is set.

### Enrichment subsystems (added on top of the core seam)

- **Full-thread capture:** ingestion listens on `client.on('message_create')` (not
  `'message'`) so your *own outbound* messages to whitelisted contacts are stored too.
  Direction comes from `message.id.fromMe`; the thread is keyed by `contact_number`
  (the other party — `fromMe ? to : from`), not `sender_number`. `listByNumber`
  filters on `contact_number`.
- **Media at capture time only:** `media/media.service.ts` downloads attachments via
  the live SDK `Message` object (media expires — a DB-polling worker can't re-fetch).
  Both live ingestion and backfill go through `whatsapp/message-mapper.ts`
  (`buildRoutable`) so they produce identical rows. Files land under
  `MEDIA_STORAGE_PATH/<contact>/`; served back via `GET /messages/:id/media`.
- **Transcription is a background worker** (`enrichment/worker.ts`, mirrors the
  `flushIgnored` timer): polls `transcription_status='pending'` audio rows and calls
  OpenAI. **Translation is on-demand** (`POST /messages/:id/translate` → DeepSeek).
  Both keys resolve via `resolveOpenAiKey()`/`resolveDeepseekKey()` — encrypted store
  first, env var fallback.
- **Encrypted credentials** (`credentials/`, `crypto/secret-box.ts`): provider keys are
  AES-256-GCM sealed under `CREDENTIALS_ENCRYPTION_KEY` in the `credentials` table.
  Plaintext lives only in the in-memory cache — never store, log, or return it (the
  API exposes `last4` only). `credentialsService.load()` runs at startup.
- **Backfill** (`backfill/`): manual-trigger, one run at a time, tracked via in-memory
  status. `fetchMessages` has no native date filter — the date window is applied
  client-side on `message.timestamp`. History depth is WhatsApp-limited. Covers both
  **whitelisted contacts** (`backfillNumber`, `POST /backfill/:number`) and **monitored
  groups** (`backfillGroup`, `POST /backfill/group/:groupId` — group-membership-gated so
  content is only pulled for opted-in groups; keys the thread by group id with per-author
  attribution, mirroring live group ingestion). `POST /backfill` (all) does contacts then
  groups. The Settings → Backfill picker prefixes option values (`c:`/`g:`) so a group id
  can't collide with a phone number.
- **Auto catch-up on reconnect:** `catchUpAll()` runs on every `client.on('ready')`
  (`events.ts`) — no separate "last run" state is stored; it derives each contact's/group's
  `since` from `MAX(timestamp)` already in `messages` (`messageService.getLastMessageTimestamp`).
  Closes gaps from downtime (PC off, connection drop) automatically for both whitelisted
  contacts and monitored groups. Threads with zero captured messages are skipped (that's an
  initial backfill — manual only). Shares the same in-memory status/one-run-at-a-time guard
  as manual backfill, so it no-ops instead of racing a manual trigger.
- **API cost tracking** (`costs/`): one `api_costs` row per OpenAI transcription call and
  per DeepSeek translation call (translating both body + transcript on one message is two
  rows). Pricing is computed from the `OPENAI_TRANSCRIBE_COST_PER_MINUTE` /
  `DEEPSEEK_*_COST_PER_1M_TOKENS` env vars, verified against provider docs as of
  2026-07-02 — **providers change pricing without notice**, so re-verify periodically.
  A rate change only affects calls recorded after the change. `gpt-4o-transcribe` rejects
  `response_format: verbose_json` (only
  `whisper-1` supports it), so OpenAI audio duration is *estimated* from file size
  (~16kbps mono Opus, matching WhatsApp's voice-note encoding) rather than read from the
  API response — see `transcription.service.ts`. Surfaced via `GET /costs/summary`
  (dashboard KPI + Costs page) and `GET /costs`/`GET /costs/daily`.
- **`GET /contacts`** (whitelist "browse contacts" picker): uses `client.getChats()`,
  not `getContacts()` — the latter is the entire synced phone book (thousands of rows,
  each duplicated once per phone number and once per privacy LID). **Most active chats
  are LID-addressed** (`chat.id.server === 'lid'`, `chat.id.user` is an opaque id, not a
  phone number) — real numbers are resolved in one batched call via
  `client.getContactLidAndPhone()`. This LID-vs-real-number gap also affects
  `message-mapper.ts`'s `contactNumberOf()` on the live ingestion path (see below).
- SQL for the new `messages` columns still lives only in `message.service.ts`; the
  `credentials` table SQL lives only in `credentials.service.ts`. Keep that boundary.

### Non-obvious behaviors — don't regress these

- **Privacy invariant:** ignored traffic (non-whitelisted, non-monitored groups,
  `status@broadcast`) must never be stored or logged with content. It only bumps
  in-memory counters in `ignored-stats.ts`, which flush *deltas* to `ignored_stats`
  every 30s (see the `flushIgnored` timer in `app.ts`). Logging elsewhere is redacted
  (length/ids only). Storing *outbound* content is scoped to **whitelisted** contacts
  and **monitored groups** only.
- **Monitored groups (deliberate exception to the above):** a group is captured ONLY
  when explicitly added to the `groups` registry (`groupService`, mirrors the whitelist
  `Set`/hot-path pattern — no global `MONITOR_GROUPS` switch; that env flag is retired).
  Once monitored, **every member's** message is stored (a scoped, opt-in departure from
  "whitelisted contacts only"), keyed to the group thread by `contact_number = group id`
  with per-author `sender_number`/`sender_name` (pinned in `events.ts` via `buildRoutable`'s
  3rd/4th params). Groups link to an EZY Portal business partner **without a contact**
  (`groups.ezy_contact_*` nullable; `PUT /groups/:id/ezy-link` validates `bpId` only) —
  unlike the whitelist link, which requires a contact. Managed on the Whitelist page
  ("Add group conversations" button + Group conversations table); group threads appear
  in `GET /messages/threads` as `type:'group'` alongside `type:'contact'`.
- **Whitelist hot path:** `whitelistService` keeps an in-memory `Set` for O(1)
  `isWhitelisted()` checks; the cache is updated in lockstep with every DB mutation
  and loaded once at startup. All numbers are normalized to digits-only via
  `utils/phone.ts` before comparison/storage.
- **WhatsApp Web version pin:** the library ships a stale build WhatsApp rejects at
  link time. `client.ts` loads a current build from `WA_WEB_VERSION` (remote
  `webVersionCache`, fetched from `raw.githubusercontent.com` at startup). If linking
  breaks with "Couldn't link device," bump `WA_WEB_VERSION` — see README Troubleshooting.
- **Startup is non-blocking:** `whatsappService.initialize()` runs in the background
  so `/qr` and the REST API stay reachable during login. State transitions arrive via
  events, not the initialize promise.
- **Orphaned-browser self-heal (added 2026-07-14):** the Chrome that `whatsapp-web.js`
  launches routinely outlives its Node process — `tsx watch` force-kills on reload
  ("Previous process hasn't exited yet"), Ctrl-C races `client.destroy()`, and
  SIGKILL/crash skips teardown. The orphan keeps holding
  `.wwebjs_auth/session-<clientId>`, so the next boot dies with "The browser is already
  running for <dir>" or a `Page.navigate` ProtocolError — which surfaces in the UI as
  **"waiting to link device" even though the session is perfectly valid** (this exact
  misdiagnosis has cost hours; it is *not* a `WA_WEB_VERSION` problem — check for a
  stray browser first). `whatsapp/session-lock.ts` (`reclaimSessionLock()`, called at
  the top of `initialize()`) clears the lock: it only ever kills a PID that `/proc`
  confirms is a browser running with *our* `--user-data-dir`, never a liveness guess,
  so it can't hit an unrelated process. Note `SingletonLock` is a symlink to a
  *label* (`<host>-<pid>`), not a real path — probe it with `lstat`, never `existsSync`
  (which follows the link, finds nothing, and silently reports no lock).
- **READY is not self-reporting — it's probed (added 2026-07-16):** the SDK emits
  `disconnected` only when WhatsApp signals a logout/state change; **nothing wires
  browser or page death to it**. So the page can die under a live Chrome (main frame
  detaches → every call throws "Attempted to use detached Frame") while `getState()`
  happily stays `READY` — that happened for ~5h on 2026-07-16 and needed a manual
  restart. Worse, outbound's `getState() !== 'READY'` guard trusts that state, so
  sends 500'd instead of returning the clean 503. `whatsapp/health-probe.ts`
  (`runHealthProbe()`, timer in `app.ts` mirroring `flushIgnored`) executes
  `typeof window.WWebJS !== 'undefined'` in the page every
  `HEALTH_PROBE_INTERVAL_MS` — deliberately the library's **own** injection check
  (`Client.js`), not WhatsApp internals, which change every WA Web build. A throw
  means the page is gone; `false` means WA Web reloaded and lost the injection. Both
  demote the client into the **existing** `scheduleReconnect()` path — recovery stays
  in one place. Two constraints keep it safe: it only acts after `FAILURE_THRESHOLD`
  *consecutive* failures (a reconnect costs a browser relaunch, so one GC-pause blip
  must not trigger it), and it only ever demotes a `READY` client — it never marks one
  ready. Verified end-to-end by `kill -9`ing the browser: dead → recovered in 67s
  unattended. Don't "simplify" it into matching error strings like `detached Frame`
  (brittle across puppeteer versions) — the probe asserts liveness, it doesn't classify
  failures.
- **Outbound is triple-gated:** disabled unless `ENABLE_OUTBOUND=true`, then
  rate-limited, single-recipient, and the target must be either a **whitelisted
  contact** (`{ number }` → `@c.us`) or a **monitored group** (`{ groupId }` →
  `@g.us`, `groupService.isMonitored` gated). Keep it that way. Draft-reply
  (`POST /messages/:number/draft-reply`) is gated the same (whitelisted contact OR
  monitored group).
- **LID vs. real number on live ingestion (fixed 2026-07-02):** for contacts whose
  chats are privacy-LID-addressed (common — see `GET /contacts` above), `message.from`/
  `message.to` normalize to opaque LID digits that never match the whitelist, so live
  messages used to be silently dropped (only backfill/catch-up captured those threads).
  `whatsapp/lid-resolver.ts` now resolves `@lid` jids to real numbers via
  `getContactLidAndPhone()` (in-memory cached, one lookup per unique LID) *before* the
  whitelist check in `events.ts`, and the resolved number is pinned into `buildRoutable`
  (third param) so both the row's `contact_number` and the media folder are keyed by the
  real number. Backfill and `POST /outbound/send` pass the already-known number through
  the same param (`sent.to` can come back LID-addressed even when sending to `@c.us`).
  If resolution fails, the message falls back to LID digits → treated as
  non-whitelisted, same as before the fix.

## Frontend architecture

**Before writing or porting any UI, read `frontend/CONVENTIONS.md`** — it is the
authoritative style contract (this project ports Claude Design `*.dc.html` sources
into idiomatic React). `frontend/COMPONENTS.md` documents the component/prop/hook
contract. The essentials that bite people:

- **Theming is global via CSS variables + `data-theme` on `<html>`.** Never accept or
  pass a `theme` prop. Use **semantic Tailwind classes** (`bg-surface`, `text-fg`,
  `border-line`, `bg-primary`, tones `success|warning|danger|info|neutral`) — never
  raw hex or inline color styles.
- One component per file, `PascalCase.tsx`, named export, prop interface co-located
  and exported. Icons come only from `components/ui/Icon.tsx` (add glyphs there;
  never reimplement).
- Import siblings with the `@/` alias. Reuse helpers from `@/lib` (`cn`, `format`)
  and types from `@/types` — do not duplicate.
- Server state is React Query only, via the hooks in `src/hooks/` (`useStatus`,
  `useQr`, `useWhitelist`, `useMessages`). `useStatus` polls every 5s to keep the
  connection badge live. Do not add new npm dependencies.
- The API client (`src/lib/api.ts`) is same-origin in dev because Vite proxies the
  API prefixes (`/status`, `/qr`, `/whitelist`, `/messages`, `/outbound`, `/health`)
  to the backend. `VITE_API_BASE` points at an absolute backend; `VITE_API_KEY` is
  sent as `x-api-key`.
