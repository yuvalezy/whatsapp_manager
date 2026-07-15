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
  /** Per-nav-key count badges (e.g. { conversations: 3 } for unread). */
  badges?: Record<string, number>;
  /**
   * Live outbound capability. `undefined` = loading/unknown (renders the safe
   * "disabled" presentation), `false` = disabled, `true` = enabled.
   */
  outboundEnabled?: boolean;
  className?: string;
}

export function Sidebar({ activeKey, collapsed = false, onNavigate, onToggleCollapse, badges, outboundEnabled, className }: SidebarProps) {
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
          const count = badges?.[item.key] ?? 0;
          return (
            <button
              key={item.key}
              type="button"
              title={item.label}
              onClick={() => onNavigate?.(item.key)}
              className={cn(
                'relative flex w-full items-center gap-[11px] rounded-[10px] border border-transparent text-[13.5px] font-semibold transition-colors duration-100',
                collapsed ? 'justify-center p-2.5' : 'justify-start px-3 py-2.5',
                isActive
                  ? 'bg-primary-soft text-primary'
                  : 'text-fg-secondary hover:bg-surface-2 hover:text-fg',
              )}
            >
              <Icon name={item.icon} size={17} />
              {!collapsed && <span>{item.label}</span>}
              {count > 0 &&
                (collapsed ? (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
                ) : (
                  <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-primary px-1.5 text-[11px] font-bold leading-none text-primary-fg">
                    {count > 99 ? '99+' : count}
                  </span>
                ))}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className={cn(
          'mt-2 flex items-center gap-2 border-t border-line py-2.5',
          collapsed ? 'justify-center px-0' : 'justify-start px-2.5',
          outboundEnabled ? 'text-warning-fg' : 'text-fg-muted',
        )}
      >
        <Icon name={outboundEnabled ? 'send' : 'lock'} size={13} />
        {!collapsed && (
          <span className="whitespace-nowrap text-[11.5px] font-semibold">
            {outboundEnabled ? 'Outbound enabled' : 'Outbound disabled'}
          </span>
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
