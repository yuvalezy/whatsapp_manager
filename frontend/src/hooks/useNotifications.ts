import { useCallback, useEffect, useState } from 'react';

// ============================================================================
// useNotifications — browser (in-tab) desktop notifications for new inbound
// messages. Delivery rides the existing SSE stream, so notifications only fire
// while a dashboard tab is open (possibly backgrounded) — no service worker.
//
// This hook owns the Settings toggle. The actual firing lives in useSse via the
// `showNotification` free helper below, which reads localStorage + permission at
// call time so it needs no React state.
// ============================================================================

const STORAGE_KEY = 'wa_notifications_enabled';

/** Whether the user has opted in (persisted, defaults off). */
export function notificationsEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

/** Browser-notification support + current permission (safe on unsupported browsers). */
export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

interface ShowNotificationInput {
  title: string;
  body: string;
  /** Collapses repeated notifications from the same thread (use the thread id). */
  tag?: string;
  /** Invoked on click (after focusing the window). */
  onClick?: () => void;
}

/**
 * Fire a notification IF the user opted in and granted permission. Reads current
 * state at call time so callers (useSse) don't need to subscribe to changes.
 */
export function showNotification({ title, body, tag, onClick }: ShowNotificationInput): void {
  if (typeof Notification === 'undefined') return;
  if (!notificationsEnabled() || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, tag });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  } catch {
    /* notification construction can throw in some contexts — ignore */
  }
}

export interface UseNotifications {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  enabled: boolean;
  /** Turn on: requests permission if needed, persists the opt-in on grant. */
  enable: () => Promise<void>;
  disable: () => void;
}

/** Settings-page state for the desktop-notifications toggle. */
export function useNotifications(): UseNotifications {
  const supported = typeof Notification !== 'undefined';
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    notificationPermission(),
  );
  const [enabled, setEnabled] = useState<boolean>(notificationsEnabled());

  // Keep permission fresh if the user changes it from the browser UI while here.
  useEffect(() => {
    setPermission(notificationPermission());
  }, []);

  const enable = useCallback(async () => {
    if (!supported) return;
    let perm = Notification.permission;
    if (perm === 'default') {
      perm = await Notification.requestPermission();
      setPermission(perm);
    }
    if (perm === 'granted') {
      localStorage.setItem(STORAGE_KEY, 'true');
      setEnabled(true);
    }
  }, [supported]);

  const disable = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'false');
    setEnabled(false);
  }, []);

  return { supported, permission, enabled, enable, disable };
}
