import { env } from '../config/env';
import { logger } from '../logger';
import { messageService } from '../messages/message.service';
import { absoluteMediaPath } from '../media/media.service';
import { transcriptionService } from './transcription.service';
import { costService } from '../costs/cost.service';

/**
 * Max times a row is claimed for transcription before it's marked permanently
 * 'failed'. Until then a failed attempt is left retryable ('pending').
 */
const MAX_TRANSCRIPTION_ATTEMPTS = 3;

/**
 * One transcription pass: atomically CLAIM a batch of pending audio messages
 * (flipping them to 'processing' so an overlapping tick can't re-grab and
 * double-bill them), transcribe each, and write the results back. Mirrors the
 * `flushIgnored` timer in app.ts — each item is isolated so one failure can't
 * stall the batch. Gated by ENABLE_TRANSCRIPTION + a resolvable OpenAI key.
 */
export async function runTranscriptionPass(): Promise<void> {
  if (!env.ENABLE_TRANSCRIPTION || !transcriptionService.available()) return;

  // First retire poison-pill rows (stuck 'processing' at the attempt cap — e.g.
  // a file that reliably crashes the process mid-run) so they can't be reclaimed
  // and re-billed forever, then claim a fresh under-cap batch.
  const swept = await messageService.failStuckTranscriptions(MAX_TRANSCRIPTION_ATTEMPTS);
  if (swept > 0) {
    logger.warn({ count: swept }, 'Retired stuck transcription rows (attempt cap reached)');
  }

  const claimed = await messageService.claimPendingTranscriptions(
    env.TRANSCRIPTION_BATCH,
    MAX_TRANSCRIPTION_ATTEMPTS,
  );
  if (claimed.length === 0) return;

  for (const row of claimed) {
    try {
      const result = await transcriptionService.transcribe(
        absoluteMediaPath(row.media_path),
        row.media_mimetype,
      );
      await messageService.setTranscription(row.id, {
        transcript: result.text,
        language: result.language ?? null,
        status: 'done',
      });
      if (result.durationSeconds != null) {
        await costService
          .recordTranscription({ messageId: row.id, audioSeconds: result.durationSeconds })
          .catch((err) => logger.error({ err, id: row.id }, 'Failed to record transcription cost'));
      }
      logger.info({ id: row.id, chars: result.text.length }, 'Transcribed audio message');
    } catch (err) {
      logger.error({ err, id: row.id }, 'Transcription failed');
      // Leave retryable until the attempt cap is hit, then mark 'failed'.
      await messageService
        .markTranscriptionFailed(row.id, MAX_TRANSCRIPTION_ATTEMPTS)
        .catch(() => undefined);
    }
  }
}
