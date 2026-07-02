import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { CodeInline } from '@/components/ui/CodeInline';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RelativeTime } from '@/components/domain/RelativeTime';
import { useToast } from '@/components/ui/Toast';
import {
  useCredentials,
  useSetCredential,
  useDeleteCredential,
} from '@/hooks/useCredentials';
import { useWhitelist } from '@/hooks/useWhitelist';
import {
  useBackfillStatus,
  useRunBackfill,
  useRunBackfillNumber,
} from '@/hooks/useBackfill';
import { formatPhone } from '@/lib/format';

const TABS = [
  { value: 'keys', label: 'API Keys' },
  { value: 'backfill', label: 'Backfill' },
];

const EYEBROW = 'text-[11px] font-bold uppercase tracking-[0.04em] text-fg-muted';
const TH =
  'border-b border-line-strong bg-surface-2 px-3.5 py-2.5 text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-fg-secondary';
const TD = 'px-3.5 py-3 text-[13.5px] text-fg align-middle';

export function SettingsPage() {
  const [tab, setTab] = useState('keys');
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Manage encrypted provider API keys and backfill conversation history."
      />
      <div className="flex flex-col gap-[22px] p-7">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
        {tab === 'keys' ? <CredentialsTab /> : <BackfillTab />}
      </div>
    </>
  );
}

// ── API Keys ────────────────────────────────────────────────────────────────

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI (transcription)' },
  { value: 'deepseek', label: 'DeepSeek (translation)' },
  { value: 'custom', label: 'Custom…' },
];

function CredentialsTab() {
  const { data, isLoading } = useCredentials();
  const setCred = useSetCredential();
  const del = useDeleteCredential();
  const { toast } = useToast();

  const [provider, setProvider] = useState('openai');
  const [customName, setCustomName] = useState('');
  const [value, setValue] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const enabled = data?.enabled ?? false;
  const items = data?.items ?? [];

  const submit = () => {
    const name = (provider === 'custom' ? customName : provider).trim().toLowerCase();
    if (!/^[a-z0-9_-]{2,64}$/.test(name)) {
      toast({ tone: 'danger', title: 'Invalid name', description: 'Use a–z, 0–9, _ or -.' });
      return;
    }
    if (!value.trim()) {
      toast({ tone: 'danger', title: 'Value required' });
      return;
    }
    setCred.mutate(
      { name, value: value.trim() },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: `Saved ${name} key` });
          setValue('');
          setCustomName('');
        },
        onError: (e) =>
          toast({
            tone: 'danger',
            title: 'Could not save key',
            description: e instanceof Error ? e.message : 'Please try again.',
          }),
      },
    );
  };

  if (!isLoading && !enabled) {
    return (
      <div className="rounded-wm-card border border-line-strong bg-surface">
        <EmptyState
          icon="lock"
          title="Encrypted store is disabled"
          description="Set CREDENTIALS_ENCRYPTION_KEY (openssl rand -base64 32) in the backend environment and restart to store API keys encrypted at rest."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[22px]">
      {/* Add / update form */}
      <div className="flex flex-col gap-3 rounded-wm-card border border-line-strong bg-surface p-5">
        <span className={EYEBROW}>Add or replace a key</span>
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="Provider"
            value={provider}
            options={PROVIDER_OPTIONS}
            onChange={setProvider}
            className="w-[220px]"
          />
          {provider === 'custom' && (
            <Input
              label="Name"
              value={customName}
              onChange={setCustomName}
              placeholder="e.g. anthropic"
              className="w-[180px]"
            />
          )}
          <Input
            label="API key"
            type="password"
            value={value}
            onChange={setValue}
            placeholder="sk-…"
            className="min-w-[240px] flex-1"
          />
          <Button label="Save key" icon="lock" loading={setCred.isPending} onClick={submit} />
        </div>
        <span className="text-xs text-fg-muted">
          Keys are encrypted (AES-256-GCM) at rest; only the last 4 characters are ever shown.
        </span>
      </div>

      {/* Stored keys */}
      <div className="overflow-hidden rounded-wm-card border border-line-strong bg-surface">
        {isLoading ? (
          <div className="p-5 text-[13.5px] text-fg-muted">Loading…</div>
        ) : items.length === 0 ? (
          <EmptyState
            icon="key"
            title="No keys stored"
            description="Add your OpenAI and DeepSeek keys above to enable transcription and translation."
          />
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>Provider</th>
                <th className={TH}>Key</th>
                <th className={TH}>Updated</th>
                <th className={`${TH} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.name} className="border-b border-line-strong last:border-b-0 hover:bg-surface-2">
                  <td className={TD}>{c.name}</td>
                  <td className={TD}>
                    <CodeInline text={`••••${c.last4 ?? '----'}`} />
                  </td>
                  <td className={TD}>
                    <RelativeTime timestamp={c.updated_at} />
                  </td>
                  <td className={`${TD} text-right`}>
                    <IconButton
                      icon="trash"
                      size="sm"
                      variant="danger"
                      ariaLabel={`Delete ${c.name} key`}
                      onClick={() => setPendingDelete(c.name)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete API key?"
        description={pendingDelete ? `Remove the stored "${pendingDelete}" key? This can't be undone.` : ''}
        confirmLabel="Delete"
        loading={del.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const name = pendingDelete;
          if (!name) return;
          del.mutate(name, {
            onSuccess: () => toast({ tone: 'success', title: `Removed ${name} key` }),
            onError: (e) =>
              toast({
                tone: 'danger',
                title: 'Could not remove key',
                description: e instanceof Error ? e.message : 'Please try again.',
              }),
            onSettled: () => setPendingDelete(null),
          });
        }}
      />
    </div>
  );
}

// ── Backfill ────────────────────────────────────────────────────────────────

function BackfillTab() {
  const { data: whitelist } = useWhitelist();
  const { data: status } = useBackfillStatus();
  const runAll = useRunBackfill();
  const runOne = useRunBackfillNumber();
  const { toast } = useToast();

  const [target, setTarget] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const running = status?.running ?? false;
  const busy = running || runAll.isPending || runOne.isPending;

  const options = [
    { value: 'all', label: 'All whitelisted contacts' },
    ...(whitelist ?? []).map((w) => ({
      value: w.phone_number,
      label: w.label ? `${w.label} · ${formatPhone(w.phone_number)}` : formatPhone(w.phone_number),
    })),
  ];

  const run = () => {
    const window = { from: from || undefined, to: to || undefined };
    const onSuccess = () =>
      toast({ tone: 'success', title: 'Backfill started', description: 'Progress updates below.' });
    const onError = (e: unknown) =>
      toast({
        tone: 'danger',
        title: 'Could not start backfill',
        description: e instanceof Error ? e.message : 'Is WhatsApp linked and ready?',
      });

    if (target === 'all') runAll.mutate(window, { onSuccess, onError });
    else runOne.mutate({ number: target, ...window }, { onSuccess, onError });
  };

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-col gap-3 rounded-wm-card border border-line-strong bg-surface p-5">
        <span className={EYEBROW}>Pull conversation history</span>
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="Contact"
            value={target}
            options={options}
            onChange={setTarget}
            className="w-[280px]"
          />
          <Input label="From" type="date" value={from} onChange={setFrom} className="w-[170px]" />
          <Input label="To" type="date" value={to} onChange={setTo} className="w-[170px]" />
          <Button label="Run backfill" icon="refreshCw" loading={busy} disabled={running} onClick={run} />
        </div>
        <span className="text-xs text-fg-muted">
          History depth is limited to what WhatsApp has synced to this device. Dates are optional.
        </span>
      </div>

      {/* Live status */}
      <div className="flex flex-col gap-3 rounded-wm-card border border-line-strong bg-surface p-5">
        <div className="flex items-center gap-2.5">
          <span className={EYEBROW}>Status</span>
          {running ? (
            <StatusPill tone="warning" label="Running" pulse />
          ) : status?.error ? (
            <StatusPill tone="danger" label="Failed" />
          ) : status?.finishedAt ? (
            <StatusPill tone="success" label="Idle" />
          ) : (
            <StatusPill tone="neutral" label="Idle" />
          )}
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-[13.5px] text-fg">
          <StatLine label="Processed" value={status?.processed ?? 0} />
          <StatLine label="Saved" value={status?.saved ?? 0} />
          {status?.currentNumber && (
            <StatLine label="Current" value={formatPhone(status.currentNumber)} />
          )}
          {status?.finishedAt && (
            <span className="text-fg-muted">
              Finished <RelativeTime timestamp={status.finishedAt} />
            </span>
          )}
        </div>
        {status?.error && <span className="text-xs text-danger">{status.error}</span>}
      </div>
    </div>
  );
}

function StatLine({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-fg-muted">{label}</span>
      <span className="font-bold">{value}</span>
    </span>
  );
}
