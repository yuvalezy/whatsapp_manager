import fs from 'node:fs';
import path from 'node:path';
import type { Message } from 'whatsapp-web.js';
import { env } from '../config/env';
import { logger } from '../logger';
import { RoutableMedia } from '../messages/message.model';

/** mimetype → file extension (no external dep). Strips `;codecs=…` params. */
const MIME_EXT: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/amr': 'amr',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'application/pdf': 'pdf',
};

function extensionForMimetype(mimetype: string | undefined | null, filename?: string | null): string {
  if (filename && filename.includes('.')) {
    const ext = filename.split('.').pop();
    if (ext && ext.length <= 5) return ext.toLowerCase();
  }
  const base = (mimetype ?? '').split(';')[0].trim().toLowerCase();
  if (MIME_EXT[base]) return MIME_EXT[base];
  const sub = base.split('/')[1];
  return sub && /^[a-z0-9]{1,5}$/.test(sub) ? sub : 'bin';
}

const AUDIO_TYPES = new Set(['audio', 'ptt']);

/** Absolute path for a stored relative media path. */
export function absoluteMediaPath(relPath: string): string {
  return path.resolve(env.MEDIA_STORAGE_PATH, relPath);
}

export function isAudioType(mediaType: string | null | undefined): boolean {
  return AUDIO_TYPES.has(String(mediaType ?? ''));
}

/** Filesystem-safe filename fragment from a WhatsApp message id. */
function safeName(messageId: string): string {
  return messageId.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
}

/**
 * Download a message's attachment to local disk. Returns media metadata for the
 * DB row, or `undefined` when the message has no media. Never throws — failures
 * are reported via `status` ('expired' | 'failed') so ingestion keeps flowing.
 *
 * Must be called while the live SDK `Message` object is available (ingest or
 * backfill loop): media can expire and can't be re-fetched from a DB row alone.
 */
export async function downloadAndStore(
  message: Message,
  contactNumber: string,
): Promise<RoutableMedia | undefined> {
  if (!message.hasMedia) return undefined;

  const mediaType = String(message.type);
  try {
    const media = await message.downloadMedia();
    if (!media || !media.data) {
      logger.warn({ messageId: message.id?._serialized, mediaType }, 'Media unavailable (expired)');
      return { mediaType, path: null, mimetype: null, filesize: null, status: 'expired' };
    }

    const buffer = Buffer.from(media.data, 'base64');
    if (env.MEDIA_MAX_BYTES > 0 && buffer.length > env.MEDIA_MAX_BYTES) {
      logger.warn(
        { messageId: message.id?._serialized, bytes: buffer.length, max: env.MEDIA_MAX_BYTES },
        'Media exceeds MEDIA_MAX_BYTES — skipped',
      );
      return { mediaType, path: null, mimetype: media.mimetype ?? null, filesize: buffer.length, status: 'failed' };
    }

    const ext = extensionForMimetype(media.mimetype, media.filename);
    const dir = path.resolve(env.MEDIA_STORAGE_PATH, contactNumber);
    fs.mkdirSync(dir, { recursive: true });
    const relPath = path.join(contactNumber, `${safeName(message.id._serialized)}.${ext}`);
    fs.writeFileSync(path.resolve(env.MEDIA_STORAGE_PATH, relPath), buffer);

    return {
      mediaType,
      path: relPath,
      mimetype: media.mimetype ?? null,
      filesize: buffer.length,
      status: 'downloaded',
    };
  } catch (err) {
    logger.error({ err, messageId: message.id?._serialized, mediaType }, 'Media download failed');
    return { mediaType, path: null, mimetype: null, filesize: null, status: 'failed' };
  }
}

/** Coarse media bucket from a mimetype prefix — the vocabulary MessageBubble's
 *  BubbleMedia expects (image | video | audio | document). Outbound has no SDK
 *  Message to classify from until *after* the send, so unlike downloadAndStore
 *  (which trusts message.type) this derives it from what we're about to upload. */
function mediaTypeForMimetype(mimetype: string): string {
  const base = mimetype.split(';')[0].trim().toLowerCase();
  if (base.startsWith('image/')) return 'image';
  if (base.startsWith('video/')) return 'video';
  if (base.startsWith('audio/')) return 'audio';
  return 'document';
}

/**
 * Store an already-decoded OUTBOUND attachment buffer. Unlike downloadAndStore,
 * there is no SDK Message to call .downloadMedia() on — and no need for one:
 * we already have the exact bytes we uploaded via MessageMedia. Never throws;
 * a disk failure here can't be allowed to look like the WhatsApp send itself
 * failed (it already succeeded), so failures degrade to status: 'failed' just
 * like downloadAndStore does for inbound.
 *
 * The size cap is enforced by the CALLER before sending — by the time this
 * runs the message is already delivered, so re-checking size here would be
 * too late to reject; it would only downgrade an already-sent message's local
 * copy to 'failed'.
 */
export async function storeOutboundMedia(
  buffer: Buffer,
  mimetype: string,
  contactNumber: string,
  messageId: string,
  filename?: string,
): Promise<RoutableMedia> {
  const mediaType = mediaTypeForMimetype(mimetype);
  try {
    const ext = extensionForMimetype(mimetype, filename);
    const dir = path.resolve(env.MEDIA_STORAGE_PATH, contactNumber);
    fs.mkdirSync(dir, { recursive: true });
    const relPath = path.join(contactNumber, `${safeName(messageId)}.${ext}`);
    fs.writeFileSync(path.resolve(env.MEDIA_STORAGE_PATH, relPath), buffer);
    return { mediaType, path: relPath, mimetype, filesize: buffer.length, status: 'downloaded' };
  } catch (err) {
    logger.error({ err, messageId, mediaType }, 'Failed to store outbound media');
    return { mediaType, path: null, mimetype, filesize: buffer.length, status: 'failed' };
  }
}

export const mediaService = { downloadAndStore, absoluteMediaPath, isAudioType, storeOutboundMedia };
