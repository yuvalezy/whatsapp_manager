import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MessageStats } from '@/types';

/** Aggregate message statistics for the Insights page (GET /messages/stats). */
export function useStats() {
  return useQuery<MessageStats>({
    queryKey: ['messages', 'stats'],
    queryFn: api.getStats,
  });
}
