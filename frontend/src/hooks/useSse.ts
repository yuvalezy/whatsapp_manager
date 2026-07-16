import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { formatPhone, normalizeNumber } from '@/lib/format';
import { showNotification } from '@/hooks/useNotifications';
import { getToken } from '@/lib/auth';
import type { ConversationThread, StatusData, StoredMessage } from '@/types';

const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

// EventSource can't set headers, so the credential rides as a query param. The
// JWT (personal login) takes precedence over the optional API-key fallback.
function eventsUrl(): string {
  const token = getToken();
  if (token) return `${BASE}/events?access_token=${encodeURIComponent(token)}`;
  return `${BASE}/events${API_KEY ? `?api_key=${encodeURIComponent(API_KEY)}` : ''}`;
}

const TYPE_PREVIEW: Record<string, string> = {
  image: '📷 Photo',
  video: '🎥 Video',
  ptt: '🎤 Voice note',
  audio: '🎵 Audio',
  document: '📄 Document',
  sticker: 'Sticker',
  location: '📍 Location',
  vcard: 'Contact card',
};

function previewOf(msg: StoredMessage): string {
  return msg.body?.trim() || msg.transcript?.trim() || TYPE_PREVIEW[msg.message_type] || 'New message';
}

export function useSse() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // The currently-open thread id, tracked in a ref so the EventSource effect
  // below stays stable (no reconnect on navigation).
  const openThreadRef = useRef<string>('');
  useEffect(() => {
    openThreadRef.current = normalizeNumber(searchParams.get('number') ?? '');
  }, [searchParams]);

  useEffect(() => {
    const es = new EventSource(eventsUrl());

    es.addEventListener('message', (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data) as StoredMessage;
        const normalized = normalizeNumber(msg.contact_number || '');
        if (!normalized) return;

        qc.invalidateQueries({ queryKey: ['messages', 'by-number', normalized] });
        qc.invalidateQueries({ queryKey: ['threads'] });

        // Notify on inbound messages the user isn't actively watching, unless
        // the chat is muted in WhatsApp itself and we weren't @mentioned.
        const isOpenAndVisible = normalized === openThreadRef.current && !document.hidden;
        const muted = !!msg.metadata?.chatMuted;
        const mentionsMe = !!msg.metadata?.mentionsMe;
        if (msg.direction === 'inbound' && !isOpenAndVisible && !(muted && !mentionsMe)) {
          const thread = qc
            .getQueryData<ConversationThread[]>(['threads'])
            ?.find((t) => t.id === normalized);
          const isGroup = thread?.type === 'group' || !!msg.chat_id?.endsWith('@g.us');
          const preview = previewOf(msg);
          const title =
            thread?.label || (isGroup ? 'Group message' : msg.sender_name || formatPhone(normalized));
          const body = isGroup ? `${msg.sender_name ?? 'Someone'}: ${preview}` : preview;
          showNotification({
            title,
            body,
            tag: normalized,
            onClick: () => navigate(`/conversations?number=${normalized}`),
          });
        }
      } catch {
        /* ignore malformed events */
      }
    });

    // Delivery-state (ack) changes for our own outbound messages.
    es.addEventListener('ack', (e: MessageEvent) => {
      try {
        const { contact_number } = JSON.parse(e.data) as { contact_number: string | null };
        const normalized = normalizeNumber(contact_number || '');
        if (normalized) {
          qc.invalidateQueries({ queryKey: ['messages', 'by-number', normalized] });
        }
        qc.invalidateQueries({ queryKey: ['threads'] });
      } catch {
        /* ignore */
      }
    });

    // In-place update to an already-captured message: a sender edit, a revoke
    // (soft-delete), a reaction added/removed, or the background transcription
    // worker finishing. Refresh the affected thread + the list; no
    // notification — it isn't a new inbound message. (Translation
    // self-invalidates via its own mutation, so it doesn't broadcast here.)
    es.addEventListener('message-updated', (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data) as StoredMessage;
        const normalized = normalizeNumber(msg.contact_number || '');
        if (normalized) {
          qc.invalidateQueries({ queryKey: ['messages', 'by-number', normalized] });
        }
        qc.invalidateQueries({ queryKey: ['threads'] });
      } catch {
        /* ignore */
      }
    });

    es.addEventListener('status', (e: MessageEvent) => {
      try {
        const status = JSON.parse(e.data) as StatusData;
        qc.setQueryData<StatusData>(['status'], status);
      } catch {
        /* ignore */
      }
    });

    const refetchAll = () => {
      qc.invalidateQueries({ queryKey: ['status'] });
      qc.invalidateQueries({ queryKey: ['threads'] });
      qc.invalidateQueries({ queryKey: ['messages'] });
    };

    es.addEventListener('open', () => {
      refetchAll();
    });

    es.addEventListener('error', () => {
      /* EventSource auto-reconnects; on next 'open' we refetch */
    });

    return () => {
      es.close();
    };
  }, [qc, navigate]);
}
