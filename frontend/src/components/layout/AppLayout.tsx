import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { NAV_ITEMS, activeKeyForPath } from './nav';
import { useSse } from '@/hooks/useSse';
import { useStatus } from '@/hooks/useStatus';
import { useThreads } from '@/hooks/useThreads';

// ============================================================================
// AppLayout — the application shell: Sidebar + TopBar + routed content.
// Ported from AppLayout.dc.html and wired to React Router. Each page renders
// its own PageHeader + body inside the scrollable content area.
//
// Responsive: below `lg` the static sidebar is hidden and the TopBar's menu
// button opens it as a slide-over drawer (closed on navigate/backdrop/Escape).
// ============================================================================

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const activeKey = activeKeyForPath(location.pathname);

  useSse();

  const { data: threads } = useThreads();
  const { data: status } = useStatus();
  const unreadTotal = (threads ?? []).reduce((sum, t) => sum + (t.unread ?? 0), 0);

  const handleNavigate = (key: string) => {
    const item = NAV_ITEMS.find((n) => n.key === key);
    if (item) navigate(item.path);
    setMobileNavOpen(false);
  };

  // Close the drawer on Escape (mirrors the overlay conventions in Modal).
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg">
      <Sidebar
        className="hidden lg:flex"
        activeKey={activeKey}
        collapsed={collapsed}
        onNavigate={handleNavigate}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        badges={{ conversations: unreadTotal }}
        outboundEnabled={status?.outboundEnabled}
      />
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 z-10 animate-wm-slide-in-left shadow-wm-pop">
            <Sidebar
              activeKey={activeKey}
              onNavigate={handleNavigate}
              badges={{ conversations: unreadTotal }}
              outboundEnabled={status?.outboundEnabled}
            />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar showMenuButton onMenuClick={() => setMobileNavOpen(true)} />
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
