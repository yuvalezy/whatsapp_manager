export type MessageDirection = 'inbound' | 'outbound';

export type MediaStatus = 'none' | 'pending' | 'downloaded' | 'failed' | 'expired';
export type TranscriptionStatus = 'none' | 'pending' | 'done' | 'failed';
export type TranslationStatus = 'none' | 'pending' | 'done' | 'failed' | 'skipped';

/** A downloaded attachment, as produced by the media service. */
export interface RoutableMedia {
  mediaType: string; // ptt | audio | image | video | document | sticker | …
  path: string | null; // relative to MEDIA_STORAGE_PATH; null when not on disk
  mimetype: string | null;
  filesize: number | null;
  status: MediaStatus;
}

/**
 * Canonical, transport-agnostic message shape used across the app.
 * The WhatsApp layer maps `whatsapp-web.js` Message objects into this,
 * so nothing downstream depends on the WhatsApp SDK.
 */
export interface RoutableMessage {
  messageId: string;
  chatId: string;
  /** The other party of the thread (normalized). Falls back to senderNumber. */
  contactNumber?: string;
  senderNumber: string;
  senderName?: string;
  body: string;
  messageType: string;
  direction: MessageDirection;
  timestamp: Date;
  detectedLanguage?: string;
  media?: RoutableMedia;
  metadata?: Record<string, unknown>;
}

/** Row shape as returned from the `messages` table. */
export interface StoredMessage {
  id: string;
  message_id: string;
  chat_id: string;
  contact_number: string | null;
  sender_number: string;
  sender_name: string | null;
  body: string | null;
  message_type: string;
  direction: MessageDirection;
  timestamp: string;
  created_at: string;

  detected_language: string | null;

  media_type: string | null;
  media_path: string | null;
  media_mimetype: string | null;
  media_filesize: number | null;
  media_status: MediaStatus;

  transcript: string | null;
  transcript_language: string | null;
  transcript_translated: string | null;
  transcription_status: TranscriptionStatus;

  translated_body: string | null;
  translation_status: TranslationStatus;
}

/** Minimal projection used by the transcription worker. */
export interface PendingTranscription {
  id: string;
  media_path: string;
  media_mimetype: string | null;
  media_type: string | null;
}
