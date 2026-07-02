import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatPhone } from '@/lib/format';
import { PhoneNumber } from './PhoneNumber';
import { RelativeTime } from './RelativeTime';
import type { PreferredLanguage, WhitelistEntry } from '@/types';

const LANGUAGE_LABEL: Record<PreferredLanguage, string> = { es: 'ES', en: 'EN', he: 'HE' };

// ============================================================================
// WhitelistTable — number / label / added / remove, with loading and empty
// states and a delete confirmation. Ported from WhitelistTable.dc.html.
// `onDelete(id)` fires after the user confirms.
// ============================================================================

export interface WhitelistTableProps {
  rows?: WhitelistEntry[];
  loading?: boolean;
  deletingId?: string | number | null;
  onDelete?: (id: string | number) => void;
  onLink?: (row: WhitelistEntry) => void;
  className?: string;
}

const TH = 'bg-surface-2 border-b border-line-strong px-4 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-fg-secondary';
const TD = 'px-4 py-3 text-[13.5px] text-fg';

export function WhitelistTable({ rows = [], loading = false, deletingId, onDelete, onLink, className }: WhitelistTableProps) {
  const [pending, setPending] = useState<WhitelistEntry | null>(null);

  if (loading) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <Skeleton width="100%" height="46px" />
        <Skeleton width="100%" height="46px" />
        <Skeleton width="100%" height="46px" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={cn('rounded-wm-card border border-line-strong bg-surface', className)}>
        <EmptyState
          icon="shield"
          title="No numbers whitelisted"
          description="Only messages from whitelisted numbers are ever captured. Add one above to start monitoring."
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
              <th className={TH}>Number</th>
              <th className={TH}>Label</th>
              <th className={TH}>Lang</th>
              <th className={TH}>EZY Portal</th>
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
                  <PhoneNumber value={row.phone_number} />
                </td>
                <td className={TD}>{row.label || '—'}</td>
                <td className={TD}>
                  <Badge label={LANGUAGE_LABEL[row.preferred_language]} tone="neutral" />
                </td>
                <td className={TD}>
                  {row.ezy_bp_name ? (
                    <span className="flex flex-col">
                      <span className="truncate font-medium text-fg">{row.ezy_bp_name}</span>
                      {row.ezy_contact_name && (
                        <span className="truncate text-[11.5px] text-fg-muted">{row.ezy_contact_name}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-fg-muted">Not linked</span>
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
                      ariaLabel={`Link ${formatPhone(row.phone_number)} to EZY Portal`}
                      onClick={() => onLink?.(row)}
                    />
                    <IconButton
                      icon="trash"
                      size="sm"
                      variant="ghost"
                      ariaLabel={`Remove ${formatPhone(row.phone_number)}`}
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
        title={pending ? `Remove ${formatPhone(pending.phone_number)}?` : 'Remove this number?'}
        description="Removed numbers stop being monitored immediately. Messages already captured stay in the log."
        confirmLabel="Remove"
        onConfirm={() => {
          if (pending) onDelete?.(pending.id);
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
