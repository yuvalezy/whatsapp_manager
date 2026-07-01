import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { QrData } from '@/types';

/**
 * QR login payload. Polls while the client is not yet connected so a freshly
 * rotated QR shows up; stops polling once READY/AUTHENTICATED.
 */
export function useQr(enabled = true) {
  return useQuery<QrData>({
    queryKey: ['qr'],
    queryFn: () => api.qr(),
    enabled,
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      if (state === 'READY' || state === 'AUTHENTICATED') return false;
      return 4_000;
    },
  });
}
