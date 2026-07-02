import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { normalizeNumber } from '@/lib/format';
import type { DraftReplyResult } from '@/types';

export function useDraftReply() {
  const qc = useQueryClient();
  return useMutation<DraftReplyResult, Error, { number: string; draft: string; messageCount?: number }>({
    mutationFn: ({ number, draft, messageCount }) => api.draftReply(number, draft, messageCount),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['costs'] });
    },
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation<{ messageId: string }, Error, { number: string; message: string }>({
    mutationFn: ({ number, message }) => api.sendMessage(number, message),
    onSuccess: (_data, variables) => {
      const normalized = normalizeNumber(variables.number);
      void qc.invalidateQueries({ queryKey: ['messages', 'by-number', normalized] });
      void qc.invalidateQueries({ queryKey: ['threads'] });
    },
  });
}
