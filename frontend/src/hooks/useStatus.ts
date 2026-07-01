import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { StatusData } from '@/types';

/**
 * Live connection + monitoring snapshot. Polls frequently so the header badge,
 * dashboard, and safety flags stay current. Set `pollMs` to 0 to disable.
 */
export function useStatus(pollMs = 5_000) {
  return useQuery<StatusData>({
    queryKey: ['status'],
    queryFn: () => api.status(),
    refetchInterval: pollMs || false,
  });
}
