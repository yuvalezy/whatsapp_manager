import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { normalizeNumber } from '@/lib/format';
import type { DraftReplyResult, OutboundAttachment } from '@/types';

/**
 * Outbound "typing…" indicator for the compose box. Throttled to one 'typing'
 * signal per 4s while the user actively types (WhatsApp expires the state
 * after ~25s on its own), plus a 'clear' once they go idle for 5s, send, or
 * leave the conversation. Fire-and-forget: failures are swallowed — presence
 * is cosmetic and must never surface an error in the composer.
 */
export function useTypingSignal(threadId: string) {
  const lastSentRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  const stopTyping = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (!activeRef.current) return;
    activeRef.current = false;
    lastSentRef.current = 0;
    void api.signalTyping(threadId, 'clear').catch(() => undefined);
  }, [threadId]);

  const signalTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSentRef.current > 4_000) {
      lastSentRef.current = now;
      activeRef.current = true;
      void api.signalTyping(threadId, 'typing').catch(() => undefined);
    }
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(stopTyping, 5_000);
  }, [threadId, stopTyping]);

  // Leaving the conversation (ComposeReply remounts per thread) clears the
  // indicator instead of leaving a phantom "typing…" on the recipient's phone.
  useEffect(() => stopTyping, [stopTyping]);

  return { signalTyping, stopTyping };
}

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
      mentions?: string[];
      /** The AI draft's already-generated counterpart in the other language, if
       * this send came from the draft-reply flow — persisted as a done
       * translation instead of left pending. */
      knownTranslation?: string;
    }
  >({
    mutationFn: ({ number, message, isGroup, quotedMessageId, attachment, mentions, knownTranslation }) =>
      isGroup
        ? api.sendGroupMessage(number, message, quotedMessageId, attachment, mentions, knownTranslation)
        : api.sendMessage(number, message, quotedMessageId, attachment, mentions, knownTranslation),
    onSuccess: (_data, variables) => {
      const normalized = normalizeNumber(variables.number);
      void qc.invalidateQueries({ queryKey: ['messages', 'by-number', normalized] });
      void qc.invalidateQueries({ queryKey: ['threads'] });
    },
  });
}
