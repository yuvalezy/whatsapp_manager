import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BackfillStatus } from '@/types';

/** Live backfill progress. Polls while a run is active. */
export function useBackfillStatus(pollMs = 3_000) {
  return useQuery<BackfillStatus>({
    queryKey: ['backfill', 'status'],
    queryFn: () => api.backfillStatus(),
    refetchInterval: pollMs || false,
  });
}

/** Trigger a backfill for all whitelisted contacts (optional date window). */
export function useRunBackfill() {
  return useMutation({
    mutationFn: (window?: { from?: string; to?: string }) => api.runBackfill(window),
  });
}

/** Trigger a backfill for a single contact (optional date window). */
export function useRunBackfillNumber() {
  return useMutation({
    mutationFn: ({ number, from, to }: { number: string; from?: string; to?: string }) =>
      api.runBackfillNumber(number, { from, to }),
  });
}

/** Trigger a backfill for a single monitored group (optional date window). */
export function useRunBackfillGroup() {
  return useMutation({
    mutationFn: ({ groupId, from, to }: { groupId: string; from?: string; to?: string }) =>
      api.runBackfillGroup(groupId, { from, to }),
  });
}
