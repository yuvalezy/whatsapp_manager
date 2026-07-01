import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { NAV_ITEMS, activeKeyForPath } from './nav';

// ============================================================================
// AppLayout — the application shell: Sidebar + TopBar + routed content.
// Ported from AppLayout.dc.html and wired to React Router. Each page renders
// its own PageHeader + body inside the scrollable content area.
// ============================================================================

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const activeKey = activeKeyForPath(location.pathname);

  const handleNavigate = (key: string) => {
    const item = NAV_ITEMS.find((n) => n.key === key);
    if (item) navigate(item.path);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg">
      <Sidebar
        activeKey={activeKey}
        collapsed={collapsed}
        onNavigate={handleNavigate}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
