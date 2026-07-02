import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { ConnectionPage } from '@/pages/ConnectionPage';
import { WhitelistPage } from '@/pages/WhitelistPage';
import { MessagesPage } from '@/pages/MessagesPage';
import { ConversationsPage } from '@/pages/ConversationsPage';
import { SearchPage } from '@/pages/SearchPage';
import { InsightsPage } from '@/pages/InsightsPage';
import { CostsPage } from '@/pages/CostsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { GalleryPage } from '@/pages/GalleryPage';

export function App() {
  return (
    <Routes>
      {/* App shell (Sidebar + TopBar + routed content) */}
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="connection" element={<ConnectionPage />} />
        <Route path="whitelist" element={<WhitelistPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="conversations" element={<ConversationsPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="costs" element={<CostsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Standalone component gallery (design-system showcase) */}
      <Route path="/gallery" element={<GalleryPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
