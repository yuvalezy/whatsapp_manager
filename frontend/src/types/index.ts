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

export interface StoredMessage {
  id: string | number;
  message_id: string;
  chat_id: string;
  sender_number: string;
  sender_name: string | null;
  body: string | null;
  message_type: MessageType;
  direction: 'inbound' | 'outbound';
  timestamp: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}
