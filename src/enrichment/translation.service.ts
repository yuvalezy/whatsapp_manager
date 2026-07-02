import { env } from '../config/env';
import { resolveDeepseekKey } from '../credentials/credentials.service';

export interface TranslationResult {
  detectedLanguage: string;
  translation: string;
}

/**
 * Translate arbitrary (possibly mixed-language) text to TARGET_LANGUAGE using
 * DeepSeek's OpenAI-compatible chat completions API. Returns the authoritative
 * source language alongside the translation. Native fetch — no SDK/dep.
 */
class TranslationService {
  /** True when a DeepSeek key is resolvable (encrypted store or env). */
  available(): boolean {
    return Boolean(resolveDeepseekKey());
  }

  async translate(text: string): Promise<TranslationResult> {
    const key = resolveDeepseekKey();
    if (!key) throw new Error('No DeepSeek API key configured');
    const target = env.TARGET_LANGUAGE;

    const res = await fetch(`${env.DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: env.TRANSLATION_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              `You are a translation engine. Detect the source language of the user's text and translate it into ${target}. ` +
              `The text may mix languages (e.g. Spanish, English, Hebrew). ` +
              `Respond with ONLY a JSON object of the form ` +
              `{"detected_language": "<ISO 639-1 code>", "translation": "<the ${target} translation>"}. ` +
              `If the text is already in ${target}, return it unchanged as the translation.`,
          },
          { role: 'user', content: text },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`DeepSeek translation failed (${res.status}): ${detail.slice(0, 300)}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? '{}';
    let parsed: { detected_language?: string; translation?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { translation: content }; // tolerate a non-JSON reply
    }
    return {
      detectedLanguage: parsed.detected_language ?? 'und',
      translation: parsed.translation ?? '',
    };
  }
}

export const translationService = new TranslationService();
