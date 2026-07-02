import { env } from '../config/env';
import { logger } from '../logger';
import { messageService } from '../messages/message.service';
import { absoluteMediaPath } from '../media/media.service';
import { transcriptionService } from './transcription.service';
import { costService } from '../costs/cost.service';

/**
 * One transcription pass: transcribe a batch of pending audio messages and
 * write the results back. Mirrors the `flushIgnored` timer in app.ts — each
 * item is isolated so one failure can't stall the batch. Gated by
 * ENABLE_TRANSCRIPTION + a resolvable OpenAI key.
 */
export async function runTranscriptionPass(): Promise<void> {
  if (!env.ENABLE_TRANSCRIPTION || !transcriptionService.available()) return;

  const pending = await messageService.listPendingTranscription(env.TRANSCRIPTION_BATCH);
  if (pending.length === 0) return;

  for (const row of pending) {
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
      await messageService
        .setTranscription(row.id, { transcript: null, language: null, status: 'failed' })
        .catch(() => undefined);
    }
  }
}
