// ============================================================================
// API types — mirror the WhatsApp Manager Express backend response shapes.
// All endpoints wrap their payload in `{ data: ... }` (see src/*/*.routes.ts).
// ============================================================================

export type ConnectionState =
  | 'INITIALIZING'
  | 'QR_READY'
  | 'AUTHENTICATED'
  | 'READY'
  | 'DISCONNECTED'
  | 'AUTH_FAILURE'
  | 'ERROR';

export type MessageType =
  | 'chat'
  | 'image'
  | 'video'
  | 'audio'
  | 'ptt'
  | 'document'
  | 'sticker'
  | 'location'
  | 'vcard'
  | (string & {});

export type IgnoredReason = 'not_whitelisted' | 'group' | 'status_broadcast' | (string & {});

export interface StatusData {
  state: ConnectionState;
  pushname?: string | null;
  wid?: string | null;
  readyAt?: string | null;
  whitelistCount: number;
  outboundEnabled: boolean;
  monitorGroups: boolean;
  monitoredGroupCount?: number;
  ignored: Record<IgnoredReason, number>;
  ignoredTotal: number;
  transcriptionEnabled?: boolean;
  hasOpenAiKey?: boolean;
  hasDeepseekKey?: boolean;
}

export interface HealthData {
  status: string;
  uptime: number;
  state: ConnectionState;
}

export interface QrData {
  state: ConnectionState;
  qr: string | null;
  dataUrl: string | null;
}

// Result of GET /auth/me — confirms the current credential is still valid.
export interface AuthMe {
  authenticated: boolean;
  kind: 'user' | 'apikey';
  username: string | null;
}

export type PreferredLanguage = 'es' | 'en' | 'he';

export interface WhitelistEntry {
  id: string | number;
  phone_number: string;
  label: string | null;
  created_at: string;
  ezy_bp_id?: string | null;
  ezy_bp_code?: string | null;
  ezy_bp_name?: string | null;
  ezy_contact_id?: string | null;
  ezy_contact_name?: string | null;
  ezy_linked_at?: string | null;
  preferred_language: PreferredLanguage;
}

export interface EzyBusinessPartner {
  id: string;
  code: string;
  name: string;
  legalName?: string | null;
  status: string;
  roles: string[];
}

export interface EzyContact {
  id: string;
  bpId: string;
  firstName: string;
  lastName: string;
  role: string;
  isPrimary: boolean;
  email?: string | null;
  mobile?: string | null;
  whatsapp?: string | null;
  jobTitle?: string | null;
}

export interface CreateEzyContactInput {
  firstName: string;
  lastName: string;
  role?: string;
  email?: string;
  mobile?: string;
  whatsapp?: string;
  jobTitle?: string;
}

export interface EzyLinkInput {
  bpId: string;
  bpCode: string;
  bpName: string;
  contactId: string;
  contactName: string;
}

export interface WhatsAppContact {
  number: string;
  name: string;
  lastActivity: string | null;
  whitelisted: boolean;
}

// A monitored WhatsApp group. Links to an EZY Portal business partner WITHOUT a
// contact, so the ezy_contact_* fields are always null (kept for parity).
export interface GroupEntry {
  id: string | number;
  group_id: string;
  chat_id: string;
  subject: string | null;
  created_at: string;
  ezy_bp_id?: string | null;
  ezy_bp_code?: string | null;
  ezy_bp_name?: string | null;
  ezy_contact_id?: string | null;
  ezy_contact_name?: string | null;
  ezy_linked_at?: string | null;
}

// A real WhatsApp group from the linked account, for the "add group conversations" picker.
export interface AvailableGroup {
  groupId: string;
  chatId: string;
  subject: string;
  lastActivity: string | null;
  monitored: boolean;
}

// A live member of a monitored group, for the compose @-mention picker.
//   jid    — serialized WID; passed in the send's `mentions[]` to tag them.
//   user   — the jid's user part; the "@<user>" token embedded in the sent body.
//   number — resolved real phone (LID-aware), for display + whitelist matching.
export interface GroupParticipant {
  jid: string;
  user: string;
  number: string;
  name: string | null;
}

// Group → business partner link (BP only — no contact).
export interface GroupEzyLinkInput {
  bpId: string;
  bpCode: string;
  bpName: string;
}

export type MediaStatus = 'none' | 'pending' | 'downloaded' | 'failed' | 'expired';
export type TranscriptionStatus = 'none' | 'pending' | 'done' | 'failed';
export type TranslationStatus = 'none' | 'pending' | 'done' | 'failed' | 'skipped';

/** Free-form per-message flags captured at ingestion time. */
export interface MessageMetadata {
  hasMedia?: boolean;
  isForwarded?: boolean;
  deviceType?: string;
  isGroup?: boolean;
  fromMe?: boolean;
  /** Live WhatsApp mute state of this chat at the time the message arrived. */
  chatMuted?: boolean;
  /** Whether this message @mentions our own linked account. */
  mentionsMe?: boolean;
}

/**
 * A single @mention captured from a group message body. `id` matches the
 * body's literal "@<id>" placeholder digits; `number` is the resolved real
 * phone (LID-aware); `name` is the WhatsApp-reported display name captured at
 * message time (pushname/name/verifiedName).
 */
export interface MessageMention {
  id: string;
  number: string;
  name: string | null;
}

export interface StoredMessage {
  id: string | number;
  message_id: string;
  chat_id: string;
  contact_number?: string | null;
  sender_number: string;
  sender_name: string | null;
  body: string | null;
  message_type: MessageType;
  direction: 'inbound' | 'outbound';
  timestamp: string;
  created_at: string;
  metadata?: MessageMetadata | null;

  detected_language?: string | null;

  media_type?: string | null;
  media_mimetype?: string | null;
  media_filesize?: number | null;
  media_status?: MediaStatus;

  transcript?: string | null;
  transcript_language?: string | null;
  transcript_translated?: string | null;
  transcription_status?: TranscriptionStatus;

  translated_body?: string | null;
  translation_status?: TranslationStatus;

  /** WhatsApp delivery ack (outbound): -1 error, 1 sent, 2 delivered, 3 read, 4 played. */
  ack?: number | null;

  /** message_id this message quotes/replies to, if any. */
  reply_to_message_id?: string | null;

  /** @mentions parsed from a group message body, if any. */
  mentions?: MessageMention[] | null;
}

export interface CredentialSummary {
  name: string;
  last4: string | null;
  updated_at: string;
}

export interface CredentialsList {
  enabled: boolean;
  items: CredentialSummary[];
}

export interface ConversationThread {
  /** 'contact' = 1:1 whitelisted number, 'group' = monitored group. */
  type: 'contact' | 'group';
  /** Thread key — phone_number for contacts, group_id for groups. What GET /messages/:number expects. */
  id: string;
  label: string | null;
  /** Assigned EZY Portal business partner name, if any. */
  bp?: string | null;
  lastMessage: StoredMessage | null;
  /** Count of inbound messages received since this thread was last opened. */
  unread: number;
  /** Live WhatsApp mute state for this chat. */
  muted: boolean;
}

export interface TranslateAllResult {
  requested: number;
  translated: number;
  skipped: number;
  failed: number;
}

// An AI-generated conversation summary (one per "summarize last N min/hours" action).
export interface SummaryEntry {
  id: string | number;
  contact_number: string;
  title: string;
  body: string;
  window_minutes: number;
  window_start: string;
  window_end: string;
  message_count: number;
  image_count: number;
  created_at: string;
}

export interface SummarizeInput {
  amount: number;
  unit: 'minutes' | 'hours';
}

export type CostProvider = 'openai' | 'deepseek';
export type CostOperation = 'transcription' | 'translation' | 'draft_reply' | 'summary';

export interface CostEntry {
  [key: string]: unknown;
  id: string;
  provider: CostProvider;
  operation: CostOperation;
  message_id: string | null;
  audio_seconds: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number;
  created_at: string;
}

export interface ProviderCostSummary {
  provider: CostProvider;
  calls: number;
  cost_usd: number;
}

export interface CostSummary {
  month: string;
  monthlyTotal: number;
  monthlyByProvider: ProviderCostSummary[];
  allTimeTotal: number;
  allTimeByProvider: ProviderCostSummary[];
}

export interface DailyCost {
  day: string;
  provider: CostProvider;
  cost_usd: number;
}

export interface BackfillStatus {
  running: boolean;
  processed: number;
  saved: number;
  startedAt: string | null;
  finishedAt: string | null;
  currentNumber: string | null;
  error: string | null;
}

export interface DraftReplyRequest {
  draft: string;
  messageCount?: number;
}

export interface DraftReplyResult {
  english: string;
  translated: string | null;
  targetLanguage: PreferredLanguage;
}

export type ComposeState = 'idle' | 'composing' | 'generating' | 'preview' | 'sending';

/** Outbound attachment payload — base64 (no `data:` prefix) + mimetype + optional filename. */
export interface OutboundAttachment {
  data: string;
  mimetype: string;
  filename?: string;
}

// Response envelope paging block (search + list endpoints include `total`).
export interface Paging {
  limit: number;
  offset: number;
  total: number;
}

// A page of full-text search results plus its paging block.
export interface MessageSearchResult {
  rows: StoredMessage[];
  paging: Paging;
}

// Per-day inbound/outbound message volume (GET /messages/stats).
export interface DailyVolume {
  date: string;
  inbound: number;
  outbound: number;
}

// A contact ranked by captured message count (GET /messages/stats).
export interface TopContact {
  contact_number: string;
  count: number;
}

// Aggregate message statistics for the Insights page (GET /messages/stats).
export interface MessageStats {
  totalMessages: number;
  inbound: number;
  outbound: number;
  withMedia: number;
  transcribed: number;
  translated: number;
  perDay: DailyVolume[];
  topContacts: TopContact[];
}
