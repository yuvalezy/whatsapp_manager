import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { normalizeNumber } from '@/lib/format';
import type { DraftReplyResult, OutboundAttachment } from '@/types';

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
  // `number` is the thread id (contact number or group id); `isGroup` picks the
  // group send path. Invalidation keys on the same id either way.
  return useMutation<
    { messageId: string },
    Error,
    {
      number: string;
      message: string;
      isGroup?: boolean;
      quotedMessageId?: string;
      attachment?: OutboundAttachment;
    }
  >({
    mutationFn: ({ number, message, isGroup, quotedMessageId, attachment }) =>
      isGroup
        ? api.sendGroupMessage(number, message, quotedMessageId, attachment)
        : api.sendMessage(number, message, quotedMessageId, attachment),
    onSuccess: (_data, variables) => {
      const normalized = normalizeNumber(variables.number);
      void qc.invalidateQueries({ queryKey: ['messages', 'by-number', normalized] });
      void qc.invalidateQueries({ queryKey: ['threads'] });
    },
  });
}
