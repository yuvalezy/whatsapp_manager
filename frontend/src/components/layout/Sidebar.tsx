import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { NAV_ITEMS } from './nav';

// ============================================================================
// Sidebar — brand + primary nav + "outbound disabled" footer, with a collapse
// toggle. Ported from Sidebar.dc.html. Decoupled from the router: the shell
// supplies `activeKey` and `onNavigate`.
// ============================================================================

export interface SidebarProps {
  activeKey: string;
  collapsed?: boolean;
  onNavigate?: (key: string) => void;
  onToggleCollapse?: () => void;
  className?: string;
}

export function Sidebar({ activeKey, collapsed = false, onNavigate, onToggleCollapse, className }: SidebarProps) {
  return (
    <div
      className={cn(
        'relative flex h-full flex-shrink-0 flex-col gap-1 border-r border-line bg-nav p-3 transition-[width] duration-200',
        collapsed ? 'w-[72px]' : 'w-[232px]',
        className,
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          'flex items-center gap-2.5',
          collapsed ? 'justify-center px-0 pb-3.5 pt-1' : 'justify-start px-2 pb-[18px] pt-1',
        )}
      >
        <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-wm-sm bg-primary text-[15px] font-extrabold text-primary-fg">
          W
        </div>
        {!collapsed && (
          <span className="whitespace-nowrap text-sm font-bold text-fg">WhatsApp Manager</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === activeKey;
          return (
            <button
              key={item.key}
              type="button"
              title={item.label}
              onClick={() => onNavigate?.(item.key)}
              className={cn(
                'flex w-full items-center gap-[11px] rounded-[10px] border border-transparent text-[13.5px] font-semibold transition-colors duration-100',
                collapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2.5',
                isActive
                  ? 'bg-primary-soft text-primary'
                  : 'text-fg-secondary hover:bg-surface-2 hover:text-fg',
              )}
            >
              <Icon name={item.icon} size={17} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className={cn(
          'mt-2 flex items-center gap-2 border-t border-line py-2.5 text-fg-muted',
          collapsed ? 'justify-center px-0' : 'justify-start px-2.5',
        )}
      >
        <Icon name="lock" size={13} />
        {!collapsed && (
          <span className="whitespace-nowrap text-[11.5px] font-semibold">Outbound disabled</span>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        type="button"
        aria-label="Toggle sidebar"
        onClick={onToggleCollapse}
        className="absolute right-[-11px] top-5 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-line bg-nav text-fg-muted transition-colors hover:bg-surface-2"
      >
        <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={14} />
      </button>
    </div>
  );
}
