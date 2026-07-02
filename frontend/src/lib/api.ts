// ============================================================================
// API client — a tiny typed fetch wrapper around the WhatsApp Manager backend.
//
// In dev, Vite proxies /status, /qr, /whitelist, /messages, /outbound, /health
// to the Express server (see vite.config.ts), so the default base is same-origin.
// Set VITE_API_BASE to point at an absolute backend URL instead.
// Set VITE_API_KEY if the backend has API_KEY configured (sent as x-api-key).
// ============================================================================

import type {
  BackfillStatus,
  ConversationThread,
  CostEntry,
  CostSummary,
  CreateEzyContactInput,
  CredentialSummary,
  CredentialsList,
  DailyCost,
  EzyBusinessPartner,
  EzyContact,
  EzyLinkInput,
  HealthData,
  QrData,
  StatusData,
  StoredMessage,
  TranslateAllResult,
  WhatsAppContact,
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
  setWhitelistEzyLink: (id: string | number, link: EzyLinkInput) =>
    request<WhitelistEntry>(`/whitelist/${encodeURIComponent(String(id))}/ezy-link`, {
      method: 'PUT',
      body: JSON.stringify(link),
    }),

  // EZY Portal business partners + contacts (whitelist "link to EZY Portal" flow).
  listEzyBusinessPartners: (query?: string) =>
    request<EzyBusinessPartner[]>(
      `/ezy-portal/business-partners${query ? `?query=${encodeURIComponent(query)}` : ''}`,
    ),
  listEzyContacts: (bpId: string) =>
    request<EzyContact[]>(`/ezy-portal/business-partners/${encodeURIComponent(bpId)}/contacts`),
  createEzyContact: (bpId: string, input: CreateEzyContactInput) =>
    request<EzyContact>(`/ezy-portal/business-partners/${encodeURIComponent(bpId)}/contacts`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  // Real WhatsApp contacts from the linked account (for the "browse contacts" picker).
  listContacts: () => request<WhatsAppContact[]>('/contacts'),

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

  // On-demand translation (body + transcript → English) via the backend/DeepSeek.
  translateMessage: (id: string | number) =>
    request<StoredMessage>(`/messages/${encodeURIComponent(String(id))}/translate`, {
      method: 'POST',
    }),

  // One row per whitelisted contact — their latest message, sorted by recency.
  listThreads: () => request<ConversationThread[]>('/messages/threads'),

  // Translate every not-yet-translated message in a contact's thread.
  translateAll: (number: string) =>
    request<TranslateAllResult>(`/messages/${encodeURIComponent(number)}/translate-all`, {
      method: 'POST',
    }),

  // Absolute URL for a message's downloaded attachment. Usable as an <img>/<audio>
  // src — carries the API key as a query param since element requests can't set headers.
  mediaUrl: (id: string | number) => {
    const path = `${BASE}/messages/${encodeURIComponent(String(id))}/media`;
    return API_KEY ? `${path}?api_key=${encodeURIComponent(API_KEY)}` : path;
  },

  // History backfill (async on the server; poll backfillStatus for progress).
  runBackfill: (window?: { from?: string; to?: string }) =>
    request<BackfillStatus>('/backfill', {
      method: 'POST',
      body: JSON.stringify(window ?? {}),
    }),
  runBackfillNumber: (number: string, window?: { from?: string; to?: string }) =>
    request<BackfillStatus>(`/backfill/${encodeURIComponent(number)}`, {
      method: 'POST',
      body: JSON.stringify(window ?? {}),
    }),
  backfillStatus: () => request<BackfillStatus>('/backfill/status'),

  // Encrypted credentials store (values are never returned — only last4).
  listCredentials: () => request<CredentialsList>('/credentials'),
  setCredential: (name: string, value: string) =>
    request<CredentialSummary>(`/credentials/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }),
  deleteCredential: (name: string) =>
    request<{ removed: boolean }>(`/credentials/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    }),

  // API cost tracking (OpenAI transcription, DeepSeek translation).
  costSummary: () => request<CostSummary>('/costs/summary'),
  costDaily: (days = 30) => request<DailyCost[]>(`/costs/daily?days=${days}`),
  listCosts: (limit = 100) => request<CostEntry[]>(`/costs?limit=${limit}`),
};
