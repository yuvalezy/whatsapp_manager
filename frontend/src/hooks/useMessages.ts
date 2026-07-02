import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { normalizeNumber } from '@/lib/format';
import type { StoredMessage } from '@/types';

/** Recent captured messages (all whitelisted senders). */
export function useMessages(params?: { limit?: number; offset?: number }) {
  return useQuery<StoredMessage[]>({
    queryKey: ['messages', params ?? {}],
    queryFn: () => api.listMessages(params),
  });
}

/** Total number of captured messages — the real "Messages captured" KPI value
 * (the recent-list fetch is limited, so its length under-counts). */
export function useMessageCount() {
  return useQuery<{ total: number }>({
    queryKey: ['messages', 'count'],
    queryFn: () => api.getMessageCount(),
  });
}

/**
 * Messages for a single number. Pass the display number in any format — it's
 * normalized to digits (matching the backend route). Disabled for 'all'/empty.
 */
export function useMessagesByNumber(number: string | null | undefined, params?: { limit?: number; offset?: number }) {
  const normalized = number && number !== 'all' ? normalizeNumber(number) : '';
  return useQuery<StoredMessage[]>({
    queryKey: ['messages', 'by-number', normalized, params ?? {}],
    queryFn: () => api.listMessagesByNumber(normalized, params),
    enabled: !!normalized,
  });
}
