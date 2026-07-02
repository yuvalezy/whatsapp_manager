import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { normalizeNumber } from '@/lib/format';
import type { StatusData, StoredMessage } from '@/types';

const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
const API_KEY = import.meta.env.VITE_API_KEY ?? '';
const EVENTS_URL = `${BASE}/events${API_KEY ? `?api_key=${encodeURIComponent(API_KEY)}` : ''}`;

export function useSse() {
  const qc = useQueryClient();

  useEffect(() => {
    const es = new EventSource(EVENTS_URL);

    es.addEventListener('message', (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data) as StoredMessage;
        const normalized = normalizeNumber(msg.contact_number || '');
        if (!normalized) return;

        qc.invalidateQueries({ queryKey: ['messages', 'by-number', normalized] });
        qc.invalidateQueries({ queryKey: ['threads'] });
      } catch {
        /* ignore malformed events */
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
  }, [qc]);
}
