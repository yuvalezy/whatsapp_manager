import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { normalizeNumber } from '@/lib/format';
import type { ConversationThread, StoredMessage, TranslateAllResult } from '@/types';

/** One row per whitelisted contact — their latest message, sorted by recency.
  * Updated in real time via SSE (no polling). */
export function useThreads(pollMs = 0) {
  return useQuery<ConversationThread[]>({
    queryKey: ['threads'],
    queryFn: api.listThreads,
    refetchInterval: pollMs || false,
  });
}

/** Default number of newest messages loaded when a conversation is opened. */
export const DEFAULT_THREAD_PAGE = 50;

/**
 * Full thread for the open conversation. Updated in real time via SSE when new
 * messages arrive for this contact (no polling). Shares its query key with
 * `useMessagesByNumber(number, {limit})` so translate mutations refresh this too.
 */
export function useConversationThread(
  number: string | null | undefined,
  limit = DEFAULT_THREAD_PAGE,
  pollMs = 0,
) {
  const normalized = number ? normalizeNumber(number) : '';
  return useQuery<StoredMessage[]>({
    queryKey: ['messages', 'by-number', normalized, { limit }],
    queryFn: () => api.listMessagesByNumber(normalized, { limit }),
    enabled: !!normalized,
    refetchInterval: pollMs || false,
  });
}

/** Translate every not-yet-translated message in a contact's thread. */
export function useTranslateAll() {
  const qc = useQueryClient();
  return useMutation<TranslateAllResult, Error, string>({
    mutationFn: (number) => api.translateAll(number),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['messages'] });
      void qc.invalidateQueries({ queryKey: ['threads'] });
    },
  });
}

/** Mark a conversation (contact or group) read — clears unread + WhatsApp sendSeen. */
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (id) => api.markConversationRead(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['threads'] });
    },
  });
}
