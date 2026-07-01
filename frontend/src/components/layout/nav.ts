import type { IconName } from '@/components/ui/Icon';

// ============================================================================
// Navigation config — single source of truth for the sidebar + route mapping.
// Order/keys/icons mirror Sidebar.dc.html's NAV list.
// ============================================================================

export interface NavItem {
  key: string;
  label: string;
  icon: IconName;
  path: string;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'connection', label: 'Connection', icon: 'plug', path: '/connection' },
  { key: 'dashboard', label: 'Overview', icon: 'layoutGrid', path: '/' },
  { key: 'whitelist', label: 'Whitelist', icon: 'shield', path: '/whitelist' },
  { key: 'messages', label: 'Messages', icon: 'messageSquare', path: '/messages' },
];

/** Resolve the active nav key from a pathname. */
export function activeKeyForPath(pathname: string): string {
  if (pathname === '/' || pathname === '') return 'dashboard';
  const match = NAV_ITEMS.find((n) => n.path !== '/' && pathname.startsWith(n.path));
  return match?.key ?? 'dashboard';
}
