export type MessageDirection = 'inbound' | 'outbound';

/**
 * Canonical, transport-agnostic message shape used across the app.
 * The WhatsApp layer maps `whatsapp-web.js` Message objects into this,
 * so nothing downstream depends on the WhatsApp SDK.
 */
export interface RoutableMessage {
  messageId: string;
  chatId: string;
  senderNumber: string;
  senderName?: string;
  body: string;
  messageType: string;
  direction: MessageDirection;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/** Row shape as returned from the `messages` table. */
export interface StoredMessage {
  id: string;
  message_id: string;
  chat_id: string;
  sender_number: string;
  sender_name: string | null;
  body: string | null;
  message_type: string;
  direction: MessageDirection;
  timestamp: string;
  created_at: string;
}
