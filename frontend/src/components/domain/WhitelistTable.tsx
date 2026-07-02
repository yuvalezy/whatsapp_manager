import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatPhone } from '@/lib/format';
import { PhoneNumber } from './PhoneNumber';
import { RelativeTime } from './RelativeTime';
import type { PreferredLanguage, WhitelistEntry } from '@/types';

const LANGUAGE_LABEL: Record<PreferredLanguage, string> = { es: 'ES', en: 'EN', he: 'HE' };

// Every option carries a real, non-empty `value` (hard requirement for Select).
const LANGUAGE_OPTIONS: SelectOption[] = [
  { value: 'es', label: 'Spanish' },
  { value: 'en', label: 'English' },
  { value: 'he', label: 'Hebrew' },
];

// ============================================================================
// WhitelistTable — number / label / lang / EZY link / added, with loading and
// empty states, inline label + preferred-language editing, and a delete
// confirmation. Ported from WhitelistTable.dc.html.
// `onDelete(id)` fires after the user confirms; `onUpdate` fires on save.
// ============================================================================

export interface WhitelistUpdate {
  id: string | number;
  label?: string;
  preferred_language?: PreferredLanguage;
}

export interface WhitelistTableProps {
  rows?: WhitelistEntry[];
  loading?: boolean;
  deletingId?: string | number | null;
  onDelete?: (id: string | number) => void;
  onLink?: (row: WhitelistEntry) => void;
  onUpdate?: (update: WhitelistUpdate) => void;
  className?: string;
}

const TH = 'bg-surface-2 border-b border-line-strong px-4 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-fg-secondary';
const TD = 'px-4 py-3 text-[13.5px] text-fg';

export function WhitelistTable({ rows = [], loading = false, deletingId, onDelete, onLink, onUpdate, className }: WhitelistTableProps) {
  const [pending, setPending] = useState<WhitelistEntry | null>(null);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftLang, setDraftLang] = useState<PreferredLanguage>('es');

  const beginEdit = (row: WhitelistEntry) => {
    setEditingId(row.id);
    setDraftLabel(row.label ?? '');
    setDraftLang(row.preferred_language);
  };
  const cancelEdit = () => setEditingId(null);
  const saveEdit = (row: WhitelistEntry) => {
    onUpdate?.({ id: row.id, label: draftLabel.trim(), preferred_language: draftLang });
    setEditingId(null);
  };

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
            {rows.map((row) => {
              const isEditing = editingId === row.id;
              return (
              <tr
                key={row.id}
                className="border-b border-line-strong transition-colors duration-100 last:border-b-0 hover:bg-surface-2"
              >
                <td className={TD}>
                  <PhoneNumber value={row.phone_number} />
                </td>
                <td className={TD}>
                  {isEditing ? (
                    <Input
                      value={draftLabel}
                      onChange={setDraftLabel}
                      placeholder="Label"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          saveEdit(row);
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelEdit();
                        }
                      }}
                    />
                  ) : (
                    row.label || '—'
                  )}
                </td>
                <td className={TD}>
                  {isEditing ? (
                    <Select
                      value={draftLang}
                      options={LANGUAGE_OPTIONS}
                      onChange={(v) => setDraftLang(v as PreferredLanguage)}
                      aria-label="Preferred language"
                    />
                  ) : (
                    <Badge label={LANGUAGE_LABEL[row.preferred_language]} tone="neutral" />
                  )}
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
                    {isEditing ? (
                      <>
                        <IconButton
                          icon="check"
                          size="sm"
                          variant="ghost"
                          ariaLabel={`Save changes to ${formatPhone(row.phone_number)}`}
                          onClick={() => saveEdit(row)}
                        />
                        <IconButton
                          icon="x"
                          size="sm"
                          variant="ghost"
                          ariaLabel="Cancel editing"
                          onClick={cancelEdit}
                        />
                      </>
                    ) : (
                      <>
                        <IconButton
                          icon="pencil"
                          size="sm"
                          variant="ghost"
                          ariaLabel={`Edit ${formatPhone(row.phone_number)}`}
                          onClick={() => beginEdit(row)}
                        />
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
                      </>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
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
