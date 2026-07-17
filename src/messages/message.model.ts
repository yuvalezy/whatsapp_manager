export type MessageDirection = 'inbound' | 'outbound';

export type MediaStatus = 'none' | 'pending' | 'downloaded' | 'failed' | 'expired';
export type TranscriptionStatus = 'none' | 'pending' | 'processing' | 'done' | 'failed';
export type TranslationStatus = 'none' | 'pending' | 'done' | 'failed' | 'skipped';

/** A downloaded attachment, as produced by the media service. */
export interface RoutableMedia {
  mediaType: string; // ptt | audio | image | video | document | sticker | …
  path: string | null; // relative to MEDIA_STORAGE_PATH; null when not on disk
  mimetype: string | null;
  filesize: number | null;
  /** Original filename as reported by WhatsApp (documents only); null otherwise. */
  filename: string | null;
  status: MediaStatus;
}

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
 * phone (LID-aware, via lid-resolver.ts); `name` is the WhatsApp-reported
 * display name at capture time (pushname/name/verifiedName — same convention
 * as senderName: resolved once, frozen thereafter).
 */
export interface RoutableMention {
  id: string;
  number: string;
  name: string | null;
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
  metadata?: MessageMetadata;
  /** WhatsApp delivery ack (outbound): -1 error, 1 sent, 2 delivered, 3 read, 4 played. */
  ack?: number | null;
  /** message_id of the message this one quotes/replies to, if any. */
  replyToMessageId?: string | null;
  /** @mentions parsed from a group message body, if any. */
  mentions?: RoutableMention[];
}

/**
 * One emoji reaction on a stored message, as aggregated into message reads.
 * Current-state per (message, sender) — see reaction.service.ts.
 */
export interface MessageReaction {
  sender_number: string;
  reaction: string;
  timestamp: string;
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
  updated_at: string;
  metadata: MessageMetadata | null;

  detected_language: string | null;

  media_type: string | null;
  media_path: string | null;
  media_mimetype: string | null;
  media_filesize: number | null;
  media_filename: string | null;
  media_status: MediaStatus;

  transcript: string | null;
  transcript_language: string | null;
  transcript_translated: string | null;
  transcription_status: TranscriptionStatus;

  translated_body: string | null;
  translation_status: TranslationStatus;

  /** WhatsApp delivery ack (outbound): -1 error, 1 sent, 2 delivered, 3 read, 4 played. */
  ack: number | null;

  /** message_id this message quotes/replies to, if any. */
  reply_to_message_id: string | null;
  /** Set when the message body was edited in place (WhatsApp "edit message"). */
  edited_at: string | null;
  /** Soft-delete: true once the sender revoked ("delete for everyone") the message. */
  is_deleted: boolean;
  deleted_at: string | null;
  /** @mentions parsed from a group message body, if any. */
  mentions: RoutableMention[] | null;
  /** Current emoji reactions on this message (empty array when none). */
  reactions: MessageReaction[];
}

/** Minimal projection used by the transcription worker. */
export interface PendingTranscription {
  id: string;
  media_path: string;
  media_mimetype: string | null;
  media_type: string | null;
}
