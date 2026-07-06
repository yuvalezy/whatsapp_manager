import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Select, type SelectOption } from '@/components/ui/Select';
import { PhoneNumber } from './PhoneNumber';
import { RelativeTime } from './RelativeTime';
import { cn } from '@/lib/cn';
import type { Gender, WhatsAppContact } from '@/types';

const GENDER_OPTIONS: SelectOption[] = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

// ============================================================================
// ContactPickerModal — browse real WhatsApp conversations (from the linked
// account) and check-select several to whitelist at once. Already-whitelisted
// contacts show locked/checked. Presentational: the page wires data + onAdd.
// ============================================================================

export interface ContactPickerModalProps {
  open: boolean;
  contacts: WhatsAppContact[];
  loading?: boolean;
  error?: string | null;
  submitting?: boolean;
  onClose?: () => void;
  onAdd?: (entries: { number: string; label: string; gender: Gender }[]) => void;
}

export function ContactPickerModal({
  open,
  contacts,
  loading = false,
  error,
  submitting = false,
  onClose,
  onAdd,
}: ContactPickerModalProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [genders, setGenders] = useState<Record<string, Gender>>({});

  // Always start from a clean slate on open — covers every close path (Cancel,
  // backdrop, X, or the parent closing it directly after a successful add).
  useEffect(() => {
    if (open) {
      setSearch('');
      setSelected(new Set());
      setGenders({});
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => c.name.toLowerCase().includes(q) || c.number.includes(q));
  }, [contacts, search]);

  const toggle = (number: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(number)) next.delete(number);
      else next.add(number);
      return next;
    });
  };

  const handleClose = () => {
    onClose?.();
  };

  const handleAdd = () => {
    const entries = contacts
      .filter((c) => selected.has(c.number))
      .map((c) => ({ number: c.number, label: c.name, gender: genders[c.number] ?? 'unknown' }));
    onAdd?.(entries);
  };

  const showFooter = !loading && !error && contacts.length > 0;

  return (
    <Modal
      open={open}
      title="Browse WhatsApp contacts"
      description="Select contacts to whitelist. Only checked people will ever be monitored."
      size="lg"
      primaryLabel={selected.size > 0 ? `Add ${selected.size} selected` : 'Add selected'}
      loading={submitting}
      hideFooter={!showFooter}
      onPrimary={handleAdd}
      onSecondary={handleClose}
      onClose={handleClose}
    >
      <div className="flex flex-col gap-3">
        <Input placeholder="Search name or number…" value={search} icon="search" onChange={setSearch} />

        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton width="100%" height="46px" />
            <Skeleton width="100%" height="46px" />
            <Skeleton width="100%" height="46px" />
          </div>
        ) : error ? (
          <EmptyState icon="alertCircle" title="Couldn't load contacts" description={error} />
        ) : contacts.length === 0 ? (
          <EmptyState
            icon="users"
            title="No conversations found"
            description="Your linked WhatsApp account has no 1:1 conversations yet."
          />
        ) : filtered.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-fg-muted">No contacts match "{search}".</div>
        ) : (
          <div className="flex max-h-[380px] flex-col gap-1 overflow-y-auto">
            {filtered.map((c) => {
              const isSelected = selected.has(c.number);
              return (
              <div
                key={c.number}
                className={cn(
                  'flex w-full items-center gap-3 rounded-wm border border-transparent px-2.5 py-2 text-left transition-colors',
                  c.whitelisted ? 'opacity-50' : 'hover:border-line-strong hover:bg-surface-2',
                )}
              >
                <button
                  type="button"
                  disabled={c.whitelisted}
                  onClick={() => toggle(c.number)}
                  className={cn('flex min-w-0 flex-1 items-center gap-3', c.whitelisted ? 'cursor-default' : 'cursor-pointer')}
                >
                  <Checkbox checked={c.whitelisted || isSelected} disabled={c.whitelisted} />
                  <Avatar personName={c.name} size="sm" />
                  <div className="flex min-w-0 flex-1 flex-col items-start">
                    <span className="truncate text-[13.5px] font-medium text-fg">{c.name}</span>
                    <PhoneNumber value={c.number} fontSize="11.5px" />
                  </div>
                </button>
                {c.whitelisted ? (
                  <Badge label="Whitelisted" tone="success" />
                ) : isSelected ? (
                  <div className="w-[120px] shrink-0">
                    <Select
                      value={genders[c.number] ?? 'unknown'}
                      options={GENDER_OPTIONS}
                      onChange={(v) => setGenders((prev) => ({ ...prev, [c.number]: v as Gender }))}
                      aria-label={`Gender for ${c.name}`}
                    />
                  </div>
                ) : (
                  c.lastActivity && <RelativeTime timestamp={c.lastActivity} fontSize="11px" />
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
