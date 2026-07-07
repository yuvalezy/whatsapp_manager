// ============================================================================
// API client — a tiny typed fetch wrapper around the WhatsApp Manager backend.
//
// In dev, Vite proxies /status, /qr, /whitelist, /messages, /outbound, /health
// to the Express server (see vite.config.ts), so the default base is same-origin.
// Auth: the personal-login JWT (see lib/auth.ts) is sent as `Authorization:
// Bearer`, and as `?access_token=` on element/navigation URLs (media, export,
// SSE) that can't set headers. VITE_API_KEY is an optional fallback (read-only
// external key) sent as `x-api-key`.
// ============================================================================

import { clearToken, emitUnauthorized, getToken } from '@/lib/auth';
import type {
  AuthMe,
  BackfillStatus,
  ConversationThread,
  CostEntry,
  CostSummary,
  CreateEzyContactInput,
  CredentialSummary,
  CredentialsList,
  DailyCost,
  DraftReplyResult,
  EzyBusinessPartner,
  EzyContact,
  EzyLinkInput,
  AvailableGroup,
  GroupEntry,
  GroupEzyLinkInput,
  GroupParticipant,
  HealthData,
  MessageSearchResult,
  MessageStats,
  OutboundAttachment,
  Paging,
  PreferredLanguage,
  Gender,
  QrData,
  StatusData,
  StoredMessage,
  SummaryEntry,
  SummarizeInput,
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
  paging?: Paging;
}

/** Perform the fetch + shared error handling, returning the parsed JSON payload
 *  (the whole envelope, incl. `paging`). Callers that only want `data` use
 *  `request`; callers that need `paging.total` use this directly. */
async function requestRaw(path: string, init?: RequestInit): Promise<unknown> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
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
    // A rejected credential drops our token and signals the app to show login.
    // The login request itself 401s on bad credentials — don't self-evict there.
    if (res.status === 401 && path !== '/auth/login') {
      clearToken();
      emitUnauthorized();
    }
    const message =
      (payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : null) ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return payload;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const payload = await requestRaw(path, init);
  // Backend wraps most payloads in { data }. /health is bare.
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as Envelope<T>).data;
  }
  return payload as T;
}

export const api = {
  // Auth — personal login (forever-JWT) + token validation.
  login: (username: string, password: string) =>
    request<{ token: string; username: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<AuthMe>('/auth/me'),

  health: () => request<HealthData>('/health'),
  status: () => request<StatusData>('/status'),
  qr: () => request<QrData>('/qr?format=json'),

  listWhitelist: () => request<WhitelistEntry[]>('/whitelist'),
  addWhitelist: (number: string, label?: string, gender?: Gender) =>
    request<WhitelistEntry>('/whitelist', {
      method: 'POST',
      body: JSON.stringify({ number, label, gender }),
    }),
  removeWhitelist: (number: string) =>
    request<{ removed: boolean }>(`/whitelist/${encodeURIComponent(number)}`, {
      method: 'DELETE',
    }),
  // Edit an existing whitelist entry (label, preferred language, and/or gender) by id.
  updateWhitelistEntry: (
    id: string | number,
    patch: { label?: string; preferred_language?: PreferredLanguage; gender?: Gender },
  ) =>
    request<WhitelistEntry>(`/whitelist/${encodeURIComponent(String(id))}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
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

  // Monitored groups + the "add group conversations" picker + BP-only linking.
  listGroups: () => request<GroupEntry[]>('/groups'),
  listAvailableGroups: () => request<AvailableGroup[]>('/groups/available'),
  // Live member list of a monitored group (for the compose @-mention picker).
  listGroupParticipants: (groupId: string) =>
    request<GroupParticipant[]>(`/groups/${encodeURIComponent(groupId)}/participants`),
  addGroup: (groupId: string, chatId: string, subject?: string) =>
    request<GroupEntry>('/groups', {
      method: 'POST',
      body: JSON.stringify({ groupId, chatId, subject }),
    }),
  removeGroup: (groupId: string) =>
    request<{ removed: boolean }>(`/groups/${encodeURIComponent(groupId)}`, {
      method: 'DELETE',
    }),
  setGroupEzyLink: (id: string | number, link: GroupEzyLinkInput) =>
    request<GroupEntry>(`/groups/${encodeURIComponent(String(id))}/ezy-link`, {
      method: 'PUT',
      body: JSON.stringify(link),
    }),

  // Total count of captured messages (for the dashboard KPI — the recent-list
  // fetch is capped, so its length can't be used as the real total).
  getMessageCount: () => request<{ total: number }>('/messages/count'),

  listMessages: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.offset != null) q.set('offset', String(params.offset));
    const qs = q.toString();
    return request<StoredMessage[]>(`/messages${qs ? `?${qs}` : ''}`);
  },
  // `before` (ISO timestamp) + `beforeId` drive drift-free keyset "load older"
  // paging (messages strictly older than that cursor); otherwise offset paging.
  listMessagesByNumber: (
    number: string,
    params?: { limit?: number; offset?: number; before?: string; beforeId?: string | number },
  ) => {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.offset != null) q.set('offset', String(params.offset));
    if (params?.before != null) q.set('before', params.before);
    if (params?.beforeId != null) q.set('beforeId', String(params.beforeId));
    const qs = q.toString();
    return request<StoredMessage[]>(
      `/messages/${encodeURIComponent(number)}${qs ? `?${qs}` : ''}`,
    );
  },

  // Full-text search across body + transcript + translated_body. Returns the
  // page of rows AND the paging block (needs `total` for result-count paging,
  // which `request` drops — so it reads the raw envelope).
  searchMessages: async (params: {
    q: string;
    limit?: number;
    offset?: number;
    direction?: 'inbound' | 'outbound';
    type?: string;
    contactNumber?: string;
  }): Promise<MessageSearchResult> => {
    const qs = new URLSearchParams({ q: params.q });
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    if (params.direction) qs.set('direction', params.direction);
    if (params.type) qs.set('type', params.type);
    if (params.contactNumber) qs.set('contactNumber', params.contactNumber);
    const payload = (await requestRaw(`/messages/search?${qs.toString()}`)) as {
      data: StoredMessage[];
      paging: Paging;
    };
    return { rows: payload.data, paging: payload.paging };
  },

  // Aggregate message statistics for the Insights page.
  getStats: () => request<MessageStats>('/messages/stats'),

  // Streaming file download of a contact's whole thread. Usable as an <a href>
  // — carries the JWT as `?access_token=` since navigations can't set headers
  // (falls back to the API key when that's the configured credential).
  exportUrl: (number: string, format: 'json' | 'csv') => {
    const qs = new URLSearchParams({ number, format });
    const token = getToken();
    if (token) qs.set('access_token', token);
    else if (API_KEY) qs.set('api_key', API_KEY);
    return `${BASE}/messages/export?${qs.toString()}`;
  },

  // On-demand translation (body + transcript → English) via the backend/DeepSeek.
  translateMessage: (id: string | number) =>
    request<StoredMessage>(`/messages/${encodeURIComponent(String(id))}/translate`, {
      method: 'POST',
    }),

  // One row per whitelisted contact — their latest message, sorted by recency.
  listThreads: () => request<ConversationThread[]>('/messages/threads'),

  // AI conversation summaries (last N minutes/hours, with image vision) + history.
  summarize: (number: string, input: SummarizeInput) =>
    request<SummaryEntry>(`/messages/${encodeURIComponent(number)}/summarize`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  listSummaries: (number: string) =>
    request<SummaryEntry[]>(`/messages/${encodeURIComponent(number)}/summaries`),

  // Translate every not-yet-translated message in a contact's thread.
  translateAll: (number: string) =>
    request<TranslateAllResult>(`/messages/${encodeURIComponent(number)}/translate-all`, {
      method: 'POST',
    }),

  // Mark a conversation (contact or group) read: clears its unread count and
  // best-effort sends a WhatsApp read receipt (sendSeen). `id` is the thread key.
  markConversationRead: (id: string) =>
    request<{ ok: boolean }>(`/messages/${encodeURIComponent(id)}/read`, {
      method: 'POST',
    }),

  // Absolute URL for a message's downloaded attachment. Usable as an <img>/<audio>
  // src — carries the JWT as `?access_token=` since element requests can't set
  // headers (falls back to the API key when that's the configured credential).
  mediaUrl: (id: string | number) => {
    const path = `${BASE}/messages/${encodeURIComponent(String(id))}/media`;
    const token = getToken();
    if (token) return `${path}?access_token=${encodeURIComponent(token)}`;
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
  runBackfillGroup: (groupId: string, window?: { from?: string; to?: string }) =>
    request<BackfillStatus>(`/backfill/group/${encodeURIComponent(groupId)}`, {
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

  // AI-powered reply drafting — reads last N messages as context + user's notes.
  draftReply: (number: string, draft: string, messageCount = 5) =>
    request<DraftReplyResult>(`/messages/${encodeURIComponent(number)}/draft-reply`, {
      method: 'POST',
      body: JSON.stringify({ draft, messageCount }),
    }),

  // Outbound send (gated by ENABLE_OUTBOUND, rate-limited). Contact must be
  // whitelisted; group must be monitored. `quotedMessageId` (a message_id from
  // the same thread) sends the message as a WhatsApp quoted reply. `attachment`
  // sends a media message with `message` as its caption (may be omitted).
  // `mentions` (serialized jids) natively tags people — `message` must already
  // carry the matching `@<user>` tokens (built by the compose box).
  sendMessage: (
    number: string,
    message: string,
    quotedMessageId?: string,
    attachment?: OutboundAttachment,
    mentions?: string[],
    knownTranslation?: string,
  ) =>
    request<{ messageId: string }>('/outbound/send', {
      method: 'POST',
      body: JSON.stringify({ number, message, quotedMessageId, attachment, mentions, knownTranslation }),
    }),
  sendGroupMessage: (
    groupId: string,
    message: string,
    quotedMessageId?: string,
    attachment?: OutboundAttachment,
    mentions?: string[],
    knownTranslation?: string,
  ) =>
    request<{ messageId: string }>('/outbound/send', {
      method: 'POST',
      body: JSON.stringify({ groupId, message, quotedMessageId, attachment, mentions, knownTranslation }),
    }),
};
