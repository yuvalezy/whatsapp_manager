import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CostEntry, CostSummary, DailyCost } from '@/types';

/** Per-provider totals for the current month + all time. Powers the dashboard KPI. */
export function useCostSummary(pollMs = 60_000) {
  return useQuery<CostSummary>({
    queryKey: ['costs', 'summary'],
    queryFn: api.costSummary,
    refetchInterval: pollMs,
  });
}

/** Per-day, per-provider totals for a simple trend table. */
export function useDailyCosts(days = 30) {
  return useQuery<DailyCost[]>({
    queryKey: ['costs', 'daily', days],
    queryFn: () => api.costDaily(days),
  });
}

/** Recent individual cost entries (one row per transcription/translation call). */
export function useRecentCosts(limit = 100) {
  return useQuery<CostEntry[]>({
    queryKey: ['costs', 'recent', limit],
    queryFn: () => api.listCosts(limit),
  });
}
