import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { PhoneNumber } from './PhoneNumber';
import { RelativeTime } from './RelativeTime';
import { cn } from '@/lib/cn';
import type { WhatsAppContact } from '@/types';

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
  onAdd?: (entries: { number: string; label: string }[]) => void;
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

  const reset = () => {
    setSearch('');
    setSelected(new Set());
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const handleAdd = () => {
    const entries = contacts
      .filter((c) => selected.has(c.number))
      .map((c) => ({ number: c.number, label: c.name }));
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
            {filtered.map((c) => (
              <button
                key={c.number}
                type="button"
                disabled={c.whitelisted}
                onClick={() => toggle(c.number)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-wm border border-transparent px-2.5 py-2 text-left transition-colors',
                  c.whitelisted ? 'cursor-default opacity-50' : 'cursor-pointer hover:border-line-strong hover:bg-surface-2',
                )}
              >
                <Checkbox checked={c.whitelisted || selected.has(c.number)} disabled={c.whitelisted} />
                <Avatar personName={c.name} size="sm" />
                <div className="flex min-w-0 flex-1 flex-col items-start">
                  <span className="truncate text-[13.5px] font-medium text-fg">{c.name}</span>
                  <PhoneNumber value={c.number} fontSize="11.5px" />
                </div>
                {c.whitelisted ? (
                  <Badge label="Whitelisted" tone="success" />
                ) : (
                  c.lastActivity && <RelativeTime timestamp={c.lastActivity} fontSize="11px" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
