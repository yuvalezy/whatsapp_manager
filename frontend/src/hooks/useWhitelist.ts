import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { WhitelistEntry } from '@/types';

export function useWhitelist() {
  return useQuery<WhitelistEntry[]>({
    queryKey: ['whitelist'],
    queryFn: () => api.listWhitelist(),
  });
}

export function useAddWhitelist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ number, label }: { number: string; label?: string }) =>
      api.addWhitelist(number, label),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['whitelist'] });
      void qc.invalidateQueries({ queryKey: ['status'] });
    },
  });
}

export function useRemoveWhitelist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (number: string) => api.removeWhitelist(number),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['whitelist'] });
      void qc.invalidateQueries({ queryKey: ['status'] });
    },
  });
}
