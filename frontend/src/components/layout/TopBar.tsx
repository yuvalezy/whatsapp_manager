import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Switch } from '@/components/ui/Switch';
import { Avatar } from '@/components/ui/Avatar';
import { ConnectionStatusBadge } from '@/components/domain/ConnectionStatusBadge';
import { useTheme } from '@/theme/ThemeProvider';
import { useStatus } from '@/hooks/useStatus';

// ============================================================================
// TopBar — connection status, theme toggle, and account avatar. Ported from
// TopBar.dc.html. Pulls live connection state and pushname from useStatus, and
// the theme from the shared ThemeProvider.
// ============================================================================

export interface TopBarProps {
  showMenuButton?: boolean;
  onMenuClick?: () => void;
  className?: string;
}

export function TopBar({ showMenuButton = false, onMenuClick, className }: TopBarProps) {
  const { theme, isLight, toggleTheme } = useTheme();
  const { data: status } = useStatus();
  const state = status?.state ?? 'INITIALIZING';
  const accountName = status?.pushname || 'Account';

  return (
    <div
      className={cn(
        'flex h-[60px] flex-shrink-0 items-center gap-[14px] border-b border-line bg-bg px-5',
        className,
      )}
    >
      {showMenuButton && (
        <IconButton icon="menu" size="md" variant="ghost" ariaLabel="Open menu" onClick={onMenuClick} />
      )}
      <div className="flex-1" />
      <ConnectionStatusBadge state={state} />
      <Switch checked={isLight} onChange={toggleTheme} />
      <Icon name={theme === 'light' ? 'sun' : 'moon'} size={16} className="text-fg-muted" />
      <div className="h-[22px] w-px bg-line" />
      <Avatar personName={accountName} size="sm" />
    </div>
  );
}
