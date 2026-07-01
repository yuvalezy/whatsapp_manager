import { useState } from 'react';
import { cn } from '@/lib/cn';
import { useTheme } from '@/theme/ThemeProvider';
import type { ConnectionState, MessageType, StoredMessage } from '@/types';

import { Icon, iconNames } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Checkbox } from '@/components/ui/Checkbox';
import { Badge } from '@/components/ui/Badge';
import { StatusPill } from '@/components/ui/StatusPill';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Table, type TableColumn } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { Tabs } from '@/components/ui/Tabs';
import { Tooltip } from '@/components/ui/Tooltip';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Toast } from '@/components/ui/Toast';
import { Avatar } from '@/components/ui/Avatar';
import { CopyButton } from '@/components/ui/CopyButton';
import { CodeInline } from '@/components/ui/CodeInline';

import { PhoneNumber } from '@/components/domain/PhoneNumber';
import { RelativeTime } from '@/components/domain/RelativeTime';
import { MessageTypeBadge } from '@/components/domain/MessageTypeBadge';
import { ConnectionStatusBadge } from '@/components/domain/ConnectionStatusBadge';
import { QrLoginCard } from '@/components/domain/QrLoginCard';
import { AccountCard } from '@/components/domain/AccountCard';
import { IgnoredCountersPanel } from '@/components/domain/IgnoredCountersPanel';
import { SafetyFlags } from '@/components/domain/SafetyFlags';
import { AddNumberForm } from '@/components/domain/AddNumberForm';
import { WhitelistTable } from '@/components/domain/WhitelistTable';
import { MessageList } from '@/components/domain/MessageList';
import { MessageFilters } from '@/components/domain/MessageFilters';
import { MessageDetail } from '@/components/domain/MessageDetail';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageHeader } from '@/components/layout/PageHeader';

// ============================================================================
// GalleryPage — a standalone showcase of the whole component kit, ported from
// "Component Gallery.dc.html". Sticky section nav + a scrollable body. This is
// the design-system reference; the app screens live under the AppLayout shell.
// ============================================================================

const NAV = [
  ['foundations', 'Foundations'],
  ['buttons', 'Buttons & icons'],
  ['forms', 'Form controls'],
  ['feedback', 'Feedback & data'],
  ['overlays', 'Overlays'],
  ['utility', 'Utility'],
  ['shell', 'Layout shell'],
  ['domain-connection', 'Connection & account'],
  ['domain-whitelist', 'Whitelist'],
  ['domain-messages', 'Messages'],
] as const;

const CONNECTION_STATES: ConnectionState[] = [
  'INITIALIZING', 'QR_READY', 'AUTHENTICATED', 'READY', 'DISCONNECTED', 'AUTH_FAILURE', 'ERROR',
];
const MESSAGE_TYPES: MessageType[] = [
  'chat', 'image', 'video', 'audio', 'ptt', 'document', 'sticker', 'location', 'vcard',
];

const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60000).toISOString();

const SAMPLE_MESSAGES: StoredMessage[] = [
  { id: '1', message_id: 'msg_9f21ac', chat_id: '14155550132@c.us', sender_name: 'Priya Nair', sender_number: '14155550132', body: 'Hey, are we still on for 6pm?', message_type: 'chat', direction: 'inbound', timestamp: iso(4), created_at: iso(4) },
  { id: '2', message_id: 'msg_02b7e1', chat_id: '16285550198@c.us', sender_name: 'Alex Rivera', sender_number: '16285550198', body: '', message_type: 'image', direction: 'inbound', timestamp: iso(38), created_at: iso(38) },
  { id: '3', message_id: 'msg_c81f2e', chat_id: '442075550199@c.us', sender_name: 'Sam Okafor', sender_number: '442075550199', body: 'On my way!', message_type: 'chat', direction: 'inbound', timestamp: iso(210), created_at: iso(210) },
];

const WHITELIST_ROWS = [
  { id: '1', phone_number: '+14155550132', label: 'Mom', created_at: new Date(Date.now() - 41 * 86400000).toISOString() },
  { id: '2', phone_number: '+16285550198', label: 'Alex (work)', created_at: new Date(Date.now() - 29 * 86400000).toISOString() },
  { id: '3', phone_number: '+442075550199', label: '', created_at: new Date(Date.now() - 12 * 86400000).toISOString() },
];

const readyAt = new Date(Date.now() - 6 * 3600 * 1000).toISOString();

// --- small presentational helpers -------------------------------------------

function Section({ id, title, label, children }: { id: string; title: string; label?: string; children: React.ReactNode }) {
  return (
    <section id={id} data-screen-label={label ?? title} className="flex flex-col gap-4 border-b border-line px-11 py-10">
      <h2 className="m-0 text-2xl font-extrabold tracking-[-0.01em] text-fg">{title}</h2>
      {children}
    </section>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <span className="mt-2.5 text-[11.5px] font-bold uppercase tracking-wider text-fg-muted">{children}</span>;
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-3', className)}>{children}</div>;
}

function Prose({ children }: { children: React.ReactNode }) {
  return <p className="m-0 max-w-[640px] text-[13.5px] leading-relaxed text-fg-secondary">{children}</p>;
}

function Swatch({ label, hex, cls }: { label: string; hex: string; cls: string }) {
  return (
    <div className="flex w-[110px] flex-col gap-2">
      <div className={cn('h-[52px] w-full rounded-[10px] border border-line', cls)} />
      <span className="text-xs leading-normal text-fg-secondary">
        {label}
        <br />
        <code className="font-mono text-[11px] text-fg-muted">{hex}</code>
      </span>
    </div>
  );
}

const BRAND_SWATCHES = [
  ['Primary', '#25D366', 'bg-primary'],
  ['Deep accent', '#128C7E', 'bg-accent'],
  ['Warning', '#F5A623', 'bg-warning'],
  ['Danger', '#F2555A', 'bg-danger'],
  ['Info', '#4FA3D1', 'bg-info'],
] as const;

const SURFACE_SWATCHES = [
  ['bg', 'bg-bg'],
  ['nav', 'bg-nav'],
  ['surface', 'bg-surface'],
  ['surface-2', 'bg-surface-2'],
  ['line', 'bg-line'],
  ['line-strong', 'bg-line-strong'],
] as const;

const TYPE_SAMPLES = [
  ['Overview', 'Manrope 800 · 28px — page/stat values', 'text-[28px] font-extrabold'],
  ['Whitelist', 'Manrope 800 · 22px — page title', 'text-[22px] font-extrabold'],
  ['Card title', 'Manrope 700 · 15px — card/section titles', 'text-[15px] font-bold'],
  ['Body copy sits at 13.5px for density.', 'Manrope 400 · 13.5px — body', 'text-[13.5px]'],
  ['+1 415 555 0132', 'JetBrains Mono 500 · 13.5px — phone/IDs', 'font-mono text-[13.5px] font-medium'],
] as const;

const RADII = [
  ['9px', 'rounded-wm-sm'],
  ['14px', 'rounded-wm'],
  ['16px card', 'rounded-wm-card'],
  ['pill', 'rounded-pill'],
] as const;

const TABLE_COLUMNS: TableColumn<Record<string, string>>[] = [
  { key: 'number', label: 'Number', sortable: true },
  { key: 'label', label: 'Label' },
  { key: 'added', label: 'Added', align: 'right', sortable: true },
];
const TABLE_ROWS = [
  { number: '+1 415 555 0132', label: 'Mom', added: 'Jun 2' },
  { number: '+1 628 555 0198', label: 'Alex (work)', added: 'May 28' },
  { number: '+44 20 7555 0199', label: '—', added: 'May 19' },
  { number: '+91 98200 98200', label: 'Priya', added: 'Apr 30' },
];

export function GalleryPage() {
  const { theme, isLight, toggleTheme } = useTheme();
  const [form, setForm] = useState<Record<string, string>>({ err: '14155550132', disabled: 'Read only' });
  const [tab, setTab] = useState('images');
  const [sw, setSw] = useState(true);
  const [cb, setCb] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const set = (k: string) => (v: string) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <div className="flex min-h-screen bg-bg font-sans">
      {/* Section nav */}
      <div className="sticky top-0 flex h-screen w-[236px] flex-shrink-0 flex-col gap-4 overflow-auto border-r border-line bg-nav p-4">
        <div className="flex items-center gap-2.5 px-1 pb-2">
          <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-wm-sm bg-primary text-[15px] font-extrabold text-primary-fg">
            W
          </div>
          <span className="text-[13px] font-bold leading-normal text-fg">
            WhatsApp Manager
            <br />
            <span className="text-[11.5px] font-medium text-fg-muted">Component kit</span>
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          {NAV.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="block rounded-lg px-2.5 py-2 text-[13px] font-semibold text-fg-secondary no-underline hover:bg-surface-2 hover:text-fg"
            >
              {label}
            </a>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-2.5 border-t border-line pt-3.5">
          <Icon name={isLight ? 'sun' : 'moon'} size={15} className="text-fg-muted" />
          <Switch checked={isLight} label="Light mode" onChange={toggleTheme} />
        </div>
      </div>

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Section id="foundations" title="Foundations">
          <Prose>
            WhatsApp-adjacent palette — brand green, deep teal accent, neutral slate. Dark is default; every
            token has a light equivalent (theme: {theme}).
          </Prose>

          <GroupLabel>Brand &amp; semantic colors</GroupLabel>
          <div className="flex flex-wrap gap-[18px]">
            {BRAND_SWATCHES.map(([label, hex, clsName]) => (
              <Swatch key={label} label={label} hex={hex} cls={clsName} />
            ))}
          </div>

          <GroupLabel>Neutrals — surface stack (current theme)</GroupLabel>
          <div className="flex flex-wrap gap-[18px]">
            {SURFACE_SWATCHES.map(([label, clsName]) => (
              <Swatch key={label} label={label} hex="" cls={clsName} />
            ))}
          </div>

          <GroupLabel>Type scale</GroupLabel>
          <div className="flex flex-col gap-3.5">
            {TYPE_SAMPLES.map(([text, meta, clsName]) => (
              <div key={meta} className="flex flex-wrap items-baseline gap-4">
                <span className={cn('text-fg', clsName)}>{text}</span>
                <span className="font-mono text-xs text-fg-muted">{meta}</span>
              </div>
            ))}
          </div>

          <GroupLabel>Radii</GroupLabel>
          <div className="flex flex-wrap gap-[18px]">
            {RADII.map(([label, clsName]) => (
              <div
                key={label}
                className={cn(
                  'flex h-[52px] w-[90px] items-center justify-center border border-line-strong bg-surface font-mono text-[11.5px] text-fg-secondary',
                  clsName,
                )}
              >
                {label}
              </div>
            ))}
          </div>
        </Section>

        <Section id="buttons" title="Buttons & icons" label="Buttons and icons">
          <Prose>
            <CodeInline>Button</CodeInline> — variant (primary/secondary/ghost/danger) × size (sm/md/lg), plus
            loading and icon states. <CodeInline>IconButton</CodeInline> is the icon-only sibling.
          </Prose>
          <GroupLabel>Variants</GroupLabel>
          <Row>
            <Button label="Primary" variant="primary" />
            <Button label="Secondary" variant="secondary" />
            <Button label="Ghost" variant="ghost" />
            <Button label="Danger" variant="danger" />
          </Row>
          <GroupLabel>Sizes &amp; states</GroupLabel>
          <Row>
            <Button label="Small" size="sm" />
            <Button label="Medium" size="md" />
            <Button label="Large" size="lg" />
            <Button label="With icon" icon="download" />
            <Button label="Loading" loading />
            <Button label="Disabled" disabled />
          </Row>
          <GroupLabel>IconButton</GroupLabel>
          <Row>
            <IconButton icon="trash" variant="ghost" ariaLabel="Delete" />
            <IconButton icon="copy" variant="solid" ariaLabel="Copy" />
            <IconButton icon="trash" variant="danger" ariaLabel="Delete" />
            <IconButton icon="refreshCw" loading ariaLabel="Refreshing" />
            <IconButton icon="x" disabled ariaLabel="Close" />
          </Row>
          <GroupLabel>Icon set ({iconNames.length})</GroupLabel>
          <div className="grid max-w-[900px] gap-1 [grid-template-columns:repeat(auto-fill,minmax(84px,1fr))]">
            {iconNames.map((nm) => (
              <div key={nm} className="flex flex-col items-center gap-1.5 rounded-[10px] border border-line bg-surface px-1.5 py-3">
                <Icon name={nm} size={18} className="text-fg-secondary" />
                <span className="font-mono text-[10px] text-fg-muted">{nm}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section id="forms" title="Form controls" label="Form controls">
          <Prose>
            Label / hint / error live on each control directly — pass <CodeInline>error</CodeInline> to flip
            border + helper text to danger.
          </Prose>
          <div className="grid max-w-[900px] gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            <Input label="Phone number" placeholder="+1 415 555 0132" mono hint="Include country code" value={form.phone ?? ''} onChange={set('phone')} />
            <Input label="With icon" icon="search" placeholder="Search…" value={form.search ?? ''} onChange={set('search')} />
            <Input label="Number" value={form.err ?? ''} error="Already whitelisted" onChange={set('err')} />
            <Input label="Disabled" value={form.disabled ?? ''} disabled onChange={set('disabled')} />
            <Input label="Notes" multiline placeholder="Longer free text…" rows={3} value={form.notes ?? ''} onChange={set('notes')} />
            <Select
              label="Message type"
              value={form.type ?? 'all'}
              onChange={set('type')}
              options={[
                { value: 'all', label: 'All types' },
                { value: 'chat', label: 'Text' },
                { value: 'image', label: 'Image' },
                { value: 'document', label: 'Document' },
              ]}
            />
          </div>
          <Row>
            <Switch checked={sw} label="On" onChange={setSw} />
            <Switch checked={false} label="Off" onChange={() => {}} />
            <Switch checked disabled label="Disabled" />
            <Checkbox checked={cb} label="Checked" onChange={setCb} />
            <Checkbox checked={false} label="Unchecked" onChange={() => {}} />
          </Row>
        </Section>

        <Section id="feedback" title="Feedback & data display" label="Feedback and data">
          <GroupLabel>Badge &amp; StatusPill — tone: neutral / success / warning / danger / info</GroupLabel>
          <Row>
            <Badge label="document" tone="neutral" icon="fileText" />
            <Badge label="active" tone="success" />
            <Badge label="cooldown" tone="warning" />
            <Badge label="blocked" tone="danger" />
            <StatusPill label="Connected" tone="success" />
            <StatusPill label="Reconnecting" tone="warning" pulse />
            <StatusPill label="Error" tone="danger" />
          </Row>

          <GroupLabel>Card &amp; StatCard</GroupLabel>
          <Row className="items-stretch">
            <Card
              className="w-[290px]"
              title="Connection health"
              subtitle="Last checked 2m ago"
              bodyText="Session has been stable for 6 hours with no reconnects."
              actionLabel="View log"
            />
            <StatCard className="w-[190px]" label="Messages captured" value="1,284" delta="+42 today" icon="messageSquare" />
            <StatCard className="w-[190px]" label="Loading example" loading icon="shield" />
          </Row>

          <GroupLabel>Table — sortable header, sticky, hover rows, pagination</GroupLabel>
          <Table columns={TABLE_COLUMNS} rows={TABLE_ROWS} sortKey="number" sortDir="asc" showPagination totalRows={4} page={1} pageSize={4} />

          <GroupLabel>EmptyState, Skeleton, Spinner</GroupLabel>
          <Row className="items-start">
            <div className="w-[300px] rounded-wm-card border border-line-strong bg-surface">
              <EmptyState icon="shield" title="No numbers whitelisted" description="Add one to start monitoring." actionLabel="Add a number" />
            </div>
            <div className="flex w-[200px] flex-col gap-2.5">
              <Skeleton width="180px" height="14px" />
              <Skeleton width="130px" height="14px" />
              <Skeleton width="100%" height="60px" radius="12px" />
            </div>
            <Row>
              <Spinner size="sm" />
              <Spinner size="md" />
              <Spinner size="lg" />
            </Row>
          </Row>

          <GroupLabel>Tabs &amp; Tooltip</GroupLabel>
          <Row>
            <Tabs
              tabs={[
                { value: 'all', label: 'All' },
                { value: 'images', label: 'Images' },
                { value: 'docs', label: 'Docs' },
              ]}
              active={tab}
              onChange={setTab}
            />
            <Tooltip triggerLabel="wid" text="WhatsApp internal device ID" forceOpen />
          </Row>
        </Section>

        <Section id="overlays" title="Overlays" label="Overlays">
          <Prose>
            Modal is generic (title/description/actions). ConfirmDialog wraps it with a danger preset.
            MessageDetail is a right-side drawer. Toast is a single notification.
          </Prose>
          <Row>
            <Button label="Preview modal" variant="secondary" onClick={() => setModalOpen(true)} />
            <Button label="Preview confirm dialog" variant="secondary" onClick={() => setConfirmOpen(true)} />
            <Button label="Preview message drawer" variant="secondary" onClick={() => setDrawerOpen(true)} />
          </Row>
          <GroupLabel>Toast — tone: success / warning / danger / info</GroupLabel>
          <div className="flex max-w-[340px] flex-col gap-2.5">
            <Toast tone="success" title="Number whitelisted" description="+1 415 555 0132 will now be monitored." />
            <Toast tone="warning" title="Reconnecting" description="WhatsApp Web session dropped, retrying automatically." />
            <Toast tone="danger" title="Failed to remove number" description="Server did not confirm the deletion — try again." />
            <Toast tone="info" title="QR code refreshed" />
          </div>

          <Modal
            open={modalOpen}
            title="Disable outbound safety lock?"
            description="This tool stays read-only. Outbound sending remains disabled until changed in server config."
            icon="shield"
            primaryLabel="Got it"
            onPrimary={() => setModalOpen(false)}
            onSecondary={() => setModalOpen(false)}
            onClose={() => setModalOpen(false)}
          />
          <ConfirmDialog
            open={confirmOpen}
            title="Remove +1 415 555 0132?"
            onConfirm={() => setConfirmOpen(false)}
            onCancel={() => setConfirmOpen(false)}
          />
          <MessageDetail open={drawerOpen} message={SAMPLE_MESSAGES[0]} onClose={() => setDrawerOpen(false)} />
        </Section>

        <Section id="utility" title="Utility" label="Utility">
          <GroupLabel>Avatar — initials fallback, size sm/md/lg</GroupLabel>
          <Row>
            <Avatar personName="Priya Nair" size="sm" />
            <Avatar personName="Alex Rivera" size="md" />
            <Avatar personName="Sam Okafor" size="lg" />
          </Row>
          <GroupLabel>CopyButton, CodeInline, RelativeTime, PhoneNumber</GroupLabel>
          <Row>
            <CopyButton value="14155550132@c.us" label="Copy" />
            <CodeInline text="not_whitelisted" />
            <RelativeTime timestamp={iso(4)} />
            <PhoneNumber value="14155550132" />
          </Row>
        </Section>

        <Section id="shell" title="Layout shell" label="Layout shell">
          <Prose>
            Screens compose Sidebar + TopBar + PageHeader inside <CodeInline>AppLayout</CodeInline>. Below are
            the pieces in isolation.
          </Prose>
          <GroupLabel>Sidebar — expanded / collapsed</GroupLabel>
          <div className="flex flex-wrap gap-4">
            <div className="h-[420px] overflow-hidden rounded-wm border border-line">
              <Sidebar activeKey="dashboard" />
            </div>
            <div className="h-[420px] overflow-hidden rounded-wm border border-line">
              <Sidebar activeKey="messages" collapsed />
            </div>
          </div>
          <GroupLabel>PageHeader — with actions</GroupLabel>
          <div className="max-w-[760px] overflow-hidden rounded-wm border border-line">
            <PageHeader
              title="Whitelist"
              subtitle="Only numbers listed here are ever captured."
              actions={<Button label="Add number" icon="plus" />}
            />
          </div>
        </Section>

        <Section id="domain-connection" title="Connection & account" label="Connection and account">
          <GroupLabel>ConnectionStatusBadge — all 7 states</GroupLabel>
          <Row>
            {CONNECTION_STATES.map((s) => (
              <ConnectionStatusBadge key={s} state={s} />
            ))}
          </Row>
          <GroupLabel>QrLoginCard — QR ready / linked / failed with cooldown</GroupLabel>
          <div className="flex flex-wrap gap-4">
            <QrLoginCard state="QR_READY" />
            <QrLoginCard state="READY" />
            <QrLoginCard state="AUTH_FAILURE" cooldownActive cooldownSeconds={18} />
          </div>
          <GroupLabel>AccountCard, IgnoredCountersPanel &amp; SafetyFlags</GroupLabel>
          <Row className="items-start">
            <AccountCard className="w-[300px]" pushname="Jordan Lee" wid="14155550132@c.us" readyAt={readyAt} />
            <IgnoredCountersPanel className="w-[300px]" counts={{ not_whitelisted: 812, group: 94, status_broadcast: 31 }} total={937} />
            <SafetyFlags className="w-[300px]" outboundEnabled={false} monitorGroups={false} />
          </Row>
        </Section>

        <Section id="domain-whitelist" title="Whitelist" label="Whitelist domain components">
          <GroupLabel>AddNumberForm</GroupLabel>
          <AddNumberForm />
          <GroupLabel>WhitelistTable — with rows / loading / empty</GroupLabel>
          <div className="flex flex-col gap-[18px]">
            <WhitelistTable rows={WHITELIST_ROWS} />
            <WhitelistTable loading />
            <WhitelistTable rows={[]} />
          </div>
        </Section>

        <Section id="domain-messages" title="Messages" label="Messages domain components">
          <GroupLabel>MessageTypeBadge — all types</GroupLabel>
          <Row>
            {MESSAGE_TYPES.map((mt) => (
              <MessageTypeBadge key={mt} messageType={mt} />
            ))}
          </Row>
          <GroupLabel>MessageFilters</GroupLabel>
          <MessageFilters numbers={[{ phone_number: '+14155550132', label: 'Mom' }, { phone_number: '+16285550198', label: 'Alex (work)' }]} />
          <GroupLabel>MessageList — with rows / loading / empty</GroupLabel>
          <div className="flex flex-col gap-[18px]">
            <MessageList rows={SAMPLE_MESSAGES} onOpenMessage={() => setDrawerOpen(true)} />
            <MessageList loading />
            <MessageList rows={[]} />
          </div>
        </Section>
      </div>
    </div>
  );
}
