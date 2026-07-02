import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RelativeTime } from './RelativeTime';
import type { GroupEntry } from '@/types';

// ============================================================================
// GroupsTable — monitored group conversations: group / assigned business
// partner / added / actions (assign BP + stop monitoring). Mirrors
// WhitelistTable. `onDelete(group_id)` fires after the user confirms.
// ============================================================================

export interface GroupsTableProps {
  rows?: GroupEntry[];
  loading?: boolean;
  deletingId?: string | number | null;
  onDelete?: (groupId: string) => void;
  onLink?: (row: GroupEntry) => void;
  className?: string;
}

const TH = 'bg-surface-2 border-b border-line-strong px-4 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-fg-secondary';
const TD = 'px-4 py-3 text-[13.5px] text-fg';

export function GroupsTable({ rows = [], loading = false, deletingId, onDelete, onLink, className }: GroupsTableProps) {
  const [pending, setPending] = useState<GroupEntry | null>(null);

  if (loading) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <Skeleton width="100%" height="46px" />
        <Skeleton width="100%" height="46px" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={cn('rounded-wm-card border border-line-strong bg-surface', className)}>
        <EmptyState
          icon="users"
          title="No group conversations"
          description="Use “Add group conversations” above to start monitoring a WhatsApp group."
        />
      </div>
    );
  }

  return (
    <div className={cn('font-sans', className)}>
      <div className="overflow-hidden rounded-wm-card border border-line-strong bg-surface">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={TH}>Group</th>
              <th className={TH}>Business Partner</th>
              <th className={TH}>Added</th>
              <th className={cn(TH, 'w-20')} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-line-strong transition-colors duration-100 last:border-b-0 hover:bg-surface-2"
              >
                <td className={TD}>
                  <span className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg-muted">
                      <Icon name="users" size={15} />
                    </span>
                    <span className="truncate font-medium text-fg">{row.subject || row.group_id}</span>
                  </span>
                </td>
                <td className={TD}>
                  {row.ezy_bp_name ? (
                    <span className="truncate font-medium text-fg">{row.ezy_bp_name}</span>
                  ) : (
                    <span className="text-fg-muted">Not assigned</span>
                  )}
                </td>
                <td className={TD}>
                  <RelativeTime timestamp={row.created_at} />
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <IconButton
                      icon="link"
                      size="sm"
                      variant="ghost"
                      ariaLabel={`Assign ${row.subject || row.group_id} to a business partner`}
                      onClick={() => onLink?.(row)}
                    />
                    <IconButton
                      icon="trash"
                      size="sm"
                      variant="ghost"
                      ariaLabel={`Stop monitoring ${row.subject || row.group_id}`}
                      loading={deletingId != null && deletingId === row.id}
                      onClick={() => setPending(row)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={pending != null}
        title={pending ? `Stop monitoring ${pending.subject || pending.group_id}?` : 'Stop monitoring this group?'}
        description="Removed groups stop being monitored immediately. Messages already captured stay in the log."
        confirmLabel="Stop monitoring"
        onConfirm={() => {
          if (pending) onDelete?.(pending.group_id);
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
