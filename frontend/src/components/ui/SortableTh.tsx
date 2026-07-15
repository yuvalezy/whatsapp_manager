import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';

// ============================================================================
// SortableTh — a clickable <th> for hand-rolled tables (WhitelistTable,
// GroupsTable) that don't use the generic Table primitive but want the same
// sortable-header look: uppercase label + chevron on the active column.
// Mirrors the header cell rendering in Table.tsx. The header exposes a real
// focusable <button> (keyboard-sortable) and carries `aria-sort`.
// ============================================================================

export interface SortableThProps {
  label: ReactNode;
  sortKey: string;
  activeKey: string | null;
  dir: 'asc' | 'desc';
  onSort: (key: string) => void;
  className?: string;
}

const BASE_TH =
  'bg-surface-2 border-b border-line-strong px-4 py-[11px] text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-fg-secondary select-none';

export function SortableTh({ label, sortKey, activeKey, dir, onSort, className }: SortableThProps) {
  const active = activeKey === sortKey;
  const ariaSort = active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th aria-sort={ariaSort} className={cn(BASE_TH, className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="wm-focus-ring inline-flex cursor-pointer items-center gap-[5px] rounded-sm outline-none"
      >
        {label}
        {active && <Icon name={dir === 'asc' ? 'chevronUp' : 'chevronDown'} size={12} className="text-primary" />}
      </button>
    </th>
  );
}
