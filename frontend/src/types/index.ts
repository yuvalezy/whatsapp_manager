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

export interface WhitelistEntry {
  id: string | number;
  phone_number: string;
  label: string | null;
  created_at: string;
}

export interface WhatsAppContact {
  number: string;
  name: string;
  lastActivity: string | null;
  whitelisted: boolean;
}

export type MediaStatus = 'none' | 'pending' | 'downloaded' | 'failed' | 'expired';
export type TranscriptionStatus = 'none' | 'pending' | 'done' | 'failed';
export type TranslationStatus = 'none' | 'pending' | 'done' | 'failed' | 'skipped';

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
  metadata?: Record<string, unknown> | null;

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
  phone_number: string;
  label: string | null;
  lastMessage: StoredMessage | null;
}

export interface TranslateAllResult {
  requested: number;
  translated: number;
  skipped: number;
  failed: number;
}

export type CostProvider = 'openai' | 'deepseek';
export type CostOperation = 'transcription' | 'translation';

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
