import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/**
 * On-demand translation of a single message (body + transcript → English).
 * Invalidates message queries so the enriched row is refetched. Toasts are
 * raised at the call-site (see the WhitelistPage mutation pattern).
 */
export function useTranslateMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number) => api.translateMessage(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}
