import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { normalizeNumber } from '@/lib/format';
import type { SummarizeInput, SummaryEntry } from '@/types';

/** Past summaries for a thread (contact or group), newest first. */
export function useSummaries(number: string | null | undefined) {
  const normalized = number ? normalizeNumber(number) : '';
  return useQuery<SummaryEntry[]>({
    queryKey: ['summaries', normalized],
    queryFn: () => api.listSummaries(normalized),
    enabled: !!normalized,
  });
}

/** Generate a new summary for a thread. Invalidates that thread's history + costs. */
export function useSummarize() {
  const qc = useQueryClient();
  return useMutation<SummaryEntry, Error, { number: string; input: SummarizeInput }>({
    mutationFn: ({ number, input }) => api.summarize(number, input),
    onSuccess: (_data, variables) => {
      const normalized = normalizeNumber(variables.number);
      void qc.invalidateQueries({ queryKey: ['summaries', normalized] });
      void qc.invalidateQueries({ queryKey: ['costs'] });
    },
  });
}
