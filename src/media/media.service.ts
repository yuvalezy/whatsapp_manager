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

export const mediaService = { downloadAndStore, absoluteMediaPath, isAudioType };
