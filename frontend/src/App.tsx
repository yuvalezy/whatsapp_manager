import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { ConnectionPage } from '@/pages/ConnectionPage';
import { WhitelistPage } from '@/pages/WhitelistPage';
import { MessagesPage } from '@/pages/MessagesPage';
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
      </Route>

      {/* Standalone component gallery (design-system showcase) */}
      <Route path="/gallery" element={<GalleryPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
