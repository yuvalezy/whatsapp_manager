import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { CheckboxMark } from '@/components/ui/Checkbox';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { RelativeTime } from './RelativeTime';
import { cn } from '@/lib/cn';
import type { AvailableGroup } from '@/types';

// ============================================================================
// GroupPickerModal — browse real WhatsApp groups (from the linked account) and
// check-select several to monitor at once. Already-monitored groups show
// locked/checked. Presentational: the page wires data + onAdd. Mirrors
// ContactPickerModal.
// ============================================================================

export interface GroupPickerModalProps {
  open: boolean;
  groups: AvailableGroup[];
  loading?: boolean;
  error?: string | null;
  submitting?: boolean;
  onClose?: () => void;
  onAdd?: (groups: { groupId: string; chatId: string; subject: string }[]) => void;
}

export function GroupPickerModal({
  open,
  groups,
  loading = false,
  error,
  submitting = false,
  onClose,
  onAdd,
}: GroupPickerModalProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setSearch('');
      setSelected(new Set());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.subject.toLowerCase().includes(q) || g.groupId.includes(q));
  }, [groups, search]);

  const toggle = (groupId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleAdd = () => {
    const entries = groups
      .filter((g) => selected.has(g.groupId))
      .map((g) => ({ groupId: g.groupId, chatId: g.chatId, subject: g.subject }));
    onAdd?.(entries);
  };

  const showFooter = !loading && !error && groups.length > 0;

  return (
    <Modal
      open={open}
      title="Add group conversations"
      description="Select groups to monitor. Once monitored, every member's messages in the group are captured."
      size="lg"
      primaryLabel={selected.size > 0 ? `Add ${selected.size} selected` : 'Add selected'}
      loading={submitting}
      hideFooter={!showFooter}
      onPrimary={handleAdd}
      onSecondary={onClose}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <Input placeholder="Search group name…" value={search} icon="search" onChange={setSearch} />

        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton width="100%" height="46px" />
            <Skeleton width="100%" height="46px" />
            <Skeleton width="100%" height="46px" />
          </div>
        ) : error ? (
          <EmptyState icon="alertCircle" title="Couldn't load groups" description={error} />
        ) : groups.length === 0 ? (
          <EmptyState
            icon="users"
            title="No groups found"
            description="Your linked WhatsApp account has no group chats yet."
          />
        ) : filtered.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-fg-muted">No groups match "{search}".</div>
        ) : (
          <div className="flex max-h-[380px] flex-col gap-1 overflow-y-auto">
            {filtered.map((g) => {
              const isSelected = selected.has(g.groupId);
              return (
              <button
                key={g.groupId}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${g.subject}${isSelected ? ', selected' : ''}`}
                disabled={g.monitored}
                onClick={() => toggle(g.groupId)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-wm border border-transparent px-2.5 py-2 text-left transition-colors',
                  g.monitored ? 'cursor-default opacity-50' : 'cursor-pointer hover:border-line-strong hover:bg-surface-2',
                )}
              >
                <CheckboxMark checked={g.monitored || isSelected} />
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg-muted">
                  <Icon name="users" size={16} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col items-start">
                  <span className="truncate text-[13.5px] font-medium text-fg">{g.subject}</span>
                </div>
                {g.monitored ? (
                  <Badge label="Monitored" tone="success" />
                ) : (
                  g.lastActivity && <RelativeTime timestamp={g.lastActivity} fontSize="11px" />
                )}
              </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
