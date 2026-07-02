import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env';
import { resolveOpenAiKey } from '../credentials/credentials.service';

export interface TranscriptionResult {
  text: string;
  language?: string;
}

const AUDIO_MIME_FALLBACK = 'audio/ogg';

/**
 * Transcribe an audio file with OpenAI (Whisper / gpt-4o-transcribe). Uses the
 * Node 20 global fetch + FormData + Blob for multipart upload — no SDK/dep.
 * The transcript is returned in the audio's ORIGINAL language.
 */
class TranscriptionService {
  /** True when an OpenAI key is resolvable (encrypted store or env). */
  available(): boolean {
    return Boolean(resolveOpenAiKey());
  }

  async transcribe(absPath: string, mimetype?: string | null): Promise<TranscriptionResult> {
    const key = resolveOpenAiKey();
    if (!key) throw new Error('No OpenAI API key configured');

    const buffer = await fs.promises.readFile(absPath);
    const blob = new Blob([buffer], { type: mimetype || AUDIO_MIME_FALLBACK });

    const form = new FormData();
    form.append('file', blob, path.basename(absPath));
    form.append('model', env.TRANSCRIPTION_MODEL);
    form.append('response_format', 'json');

    const res = await fetch(`${env.OPENAI_BASE_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`OpenAI transcription failed (${res.status}): ${detail.slice(0, 300)}`);
    }
    const json = (await res.json()) as { text?: string; language?: string };
    return { text: json.text ?? '', language: json.language };
  }
}

export const transcriptionService = new TranscriptionService();
