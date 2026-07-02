import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { StatusData } from '@/types';

/**
 * Live connection + monitoring snapshot. Updated in real time via SSE
 * (no polling — useSse pushes status changes directly into the cache).
 * Set `pollMs` to > 0 for a polling fallback (SSE still takes priority).
 */
export function useStatus(pollMs = 0) {
  return useQuery<StatusData>({
    queryKey: ['status'],
    queryFn: () => api.status(),
    refetchInterval: pollMs || false,
  });
}
