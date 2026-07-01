// ============================================================================
// API client — a tiny typed fetch wrapper around the WhatsApp Manager backend.
//
// In dev, Vite proxies /status, /qr, /whitelist, /messages, /outbound, /health
// to the Express server (see vite.config.ts), so the default base is same-origin.
// Set VITE_API_BASE to point at an absolute backend URL instead.
// Set VITE_API_KEY if the backend has API_KEY configured (sent as x-api-key).
// ============================================================================

import type {
  HealthData,
  QrData,
  StatusData,
  StoredMessage,
  WhitelistEntry,
} from '@/types';

const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface Envelope<T> {
  data: T;
  paging?: { limit: number; offset: number };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set('Content-Type', 'application/json');
  if (API_KEY) headers.set('x-api-key', API_KEY);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch (err) {
    throw new ApiError(
      err instanceof Error ? `Network error: ${err.message}` : 'Network error',
      0,
    );
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message =
      (payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : null) ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  // Backend wraps most payloads in { data }. /health is bare.
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as Envelope<T>).data;
  }
  return payload as T;
}

export const api = {
  health: () => request<HealthData>('/health'),
  status: () => request<StatusData>('/status'),
  qr: () => request<QrData>('/qr?format=json'),

  listWhitelist: () => request<WhitelistEntry[]>('/whitelist'),
  addWhitelist: (number: string, label?: string) =>
    request<WhitelistEntry>('/whitelist', {
      method: 'POST',
      body: JSON.stringify({ number, label }),
    }),
  removeWhitelist: (number: string) =>
    request<{ removed: boolean }>(`/whitelist/${encodeURIComponent(number)}`, {
      method: 'DELETE',
    }),

  listMessages: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.offset != null) q.set('offset', String(params.offset));
    const qs = q.toString();
    return request<StoredMessage[]>(`/messages${qs ? `?${qs}` : ''}`);
  },
  listMessagesByNumber: (number: string, params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.offset != null) q.set('offset', String(params.offset));
    const qs = q.toString();
    return request<StoredMessage[]>(
      `/messages/${encodeURIComponent(number)}${qs ? `?${qs}` : ''}`,
    );
  },
};
