import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MessageSearchResult } from '@/types';

export interface MessageSearchFilters {
  direction?: 'inbound' | 'outbound';
  type?: string;
  contactNumber?: string;
}

/**
 * Full-text message search (body + transcript + translated_body). Disabled for
 * an empty query. Keeps the previous page visible while a new query/page loads
 * so the results list doesn't flicker to empty between keystrokes.
 */
export function useMessageSearch(
  q: string,
  filters: MessageSearchFilters = {},
  params: { limit?: number; offset?: number } = {},
) {
  const term = q.trim();
  return useQuery<MessageSearchResult>({
    queryKey: ['messages', 'search', term, filters, params],
    queryFn: () => api.searchMessages({ q: term, ...filters, ...params }),
    enabled: term.length > 0,
    placeholderData: keepPreviousData,
  });
}
