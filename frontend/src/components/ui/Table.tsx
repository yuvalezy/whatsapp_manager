import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

// ============================================================================
// Table — sortable, sticky-header, hoverable table with optional pagination.
// Ported from Table.dc.html. Columns may provide a `render` for custom cells;
// otherwise the raw `row[col.key]` value is shown.
// ============================================================================

export interface TableColumn<Row> {
  key: string;
  label: ReactNode;
  align?: 'left' | 'right';
  sortable?: boolean;
  render?: (row: Row) => ReactNode;
}

export type TableDensity = 'compact' | 'comfortable';

export interface TableProps<Row extends Record<string, unknown>> {
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey?: (row: Row, index: number) => string | number;
  density?: TableDensity;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  showPagination?: boolean;
  page?: number;
  pageSize?: number;
  totalRows?: number;
  onPageChange?: (page: number) => void;
  maxHeight?: string;
  className?: string;
}

export function Table<Row extends Record<string, unknown>>({
  columns,
  rows,
  rowKey,
  density = 'comfortable',
  sortKey,
  sortDir = 'asc',
  onSort,
  showPagination = false,
  page = 1,
  pageSize,
  totalRows,
  onPageChange,
  maxHeight,
  className,
}: TableProps<Row>) {
  const cellPad = density === 'compact' ? 'px-[14px] py-2' : 'px-[14px] py-[13px]';
  const size = pageSize ?? rows.length;
  const total = totalRows ?? rows.length;
  const start = total === 0 ? 0 : (page - 1) * size + 1;
  const end = Math.min(page * size, total);

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-wm-card border border-line-strong bg-surface',
        className,
      )}
    >
      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map((col) => {
                const active = !!col.sortable && sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    aria-sort={
                      col.sortable
                        ? active
                          ? sortDir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                        : undefined
                    }
                    className={cn(
                      'sticky top-0 z-[1] select-none whitespace-nowrap border-b border-line-strong bg-surface-2 text-[11.5px] font-bold uppercase tracking-[0.04em] text-fg-secondary',
                      cellPad,
                      col.align === 'right' ? 'text-right' : 'text-left',
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort?.(col.key)}
                        className={cn(
                          'wm-focus-ring inline-flex cursor-pointer items-center gap-[5px] rounded-sm outline-none',
                          col.align === 'right' && 'flex-row-reverse',
                        )}
                      >
                        {col.label}
                        {active && (
                          <Icon name={sortDir === 'asc' ? 'chevronUp' : 'chevronDown'} size={12} className="text-primary" />
                        )}
                      </button>
                    ) : (
                      <span
                        className={cn(
                          'inline-flex items-center gap-[5px]',
                          col.align === 'right' && 'flex-row-reverse',
                        )}
                      >
                        {col.label}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={rowKey ? rowKey(row, i) : i}
                className="border-b border-line-strong transition-colors duration-100 last:border-b-0 hover:bg-surface-2"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'whitespace-nowrap text-[13.5px] text-fg',
                      cellPad,
                      col.align === 'right' ? 'text-right' : 'text-left',
                    )}
                  >
                    {col.render ? col.render(row) : (row[col.key] as ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showPagination && (
        <div className="flex items-center justify-between border-t border-line-strong px-[14px] py-2.5">
          <span className="text-[12.5px] text-fg-muted">
            {total === 0 ? '0 results' : `${start}–${end} of ${total}`}
          </span>
          <div className="flex gap-1.5">
            <IconButton
              icon="chevronLeft"
              size="sm"
              variant="solid"
              ariaLabel="Previous page"
              disabled={page <= 1}
              onClick={() => onPageChange?.(Math.max(1, page - 1))}
            />
            <IconButton
              icon="chevronRight"
              size="sm"
              variant="solid"
              ariaLabel="Next page"
              disabled={end >= total}
              onClick={() => onPageChange?.(page + 1)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
