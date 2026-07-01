import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

// ============================================================================
// Tabs — segmented control. Controlled via `active` + `onChange(value)`.
// Ported from Tabs.dc.html.
// ============================================================================

export interface TabItem {
  value: string;
  label: ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  active?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  const activeValue = active ?? tabs[0]?.value;
  return (
    <div
      className={cn(
        'inline-flex gap-1 rounded-[11px] border border-line-strong bg-surface-2 p-1',
        className,
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.value === activeValue;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange?.(tab.value)}
            className={cn(
              'wm-focus-ring rounded-lg border border-transparent px-3.5 py-[7px] text-[13px] font-semibold outline-none transition-colors duration-100',
              isActive
                ? 'bg-primary text-primary-fg'
                : 'bg-transparent text-fg-secondary hover:bg-surface hover:text-fg',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
