import { env } from '../config/env';
import { resolveOpenAiKey } from '../credentials/credentials.service';
import type { StoredMessage } from '../messages/message.model';

export interface SummaryImage {
  /** `data:<mimetype>;base64,<...>` URL for an OpenAI vision `image_url` block. */
  dataUrl: string;
}

export interface SummarizationResult {
  title: string;
  body: string;
  inputTokens?: number;
  outputTokens?: number;
}

/** One transcript line per message: "HH:MM Sender: text" (falls back to transcript / [type]). */
function messagesToContext(msgs: StoredMessage[]): string {
  return msgs
    .map((m) => {
      const time = new Date(m.timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const who = m.direction === 'outbound' ? 'You' : m.sender_name || m.sender_number;
      const text = m.body?.trim() || m.transcript?.trim() || `[${m.message_type}]`;
      return `[${time}] ${who}: ${text}`;
    })
    .join('\n');
}

const SYSTEM_PROMPT =
  'You summarize a window of a WhatsApp conversation for someone who was away. ' +
  'Be concise and factual: capture what was discussed, decisions, questions, and any action items. ' +
  'If images are attached, describe what they show and fold that into the summary. ' +
  'Respond with ONLY a JSON object: {"title": "<a short title, max 8 words>", "summary": "<the summary, 1-4 short paragraphs>"}.';

/**
 * Summarize a conversation window with OpenAI (vision-capable chat model). Uses
 * the Node 20 global fetch — no SDK/dep, matching transcription/translation
 * services. Images are passed as base64 data-URL `image_url` blocks so the model
 * can see them.
 */
class SummarizationService {
  /** True when an OpenAI key is resolvable (encrypted store or env). */
  available(): boolean {
    return Boolean(resolveOpenAiKey());
  }

  async summarize(messages: StoredMessage[], images: SummaryImage[]): Promise<SummarizationResult> {
    const key = resolveOpenAiKey();
    if (!key) throw new Error('No OpenAI API key configured');

    const context = messagesToContext(messages);
    const textBlock =
      `Summarize the following WhatsApp conversation window` +
      (images.length > 0 ? ` (${images.length} image(s) attached below)` : '') +
      `:\n\n${context}`;

    // OpenAI vision content array: the transcript text, then each image.
    const userContent: Array<Record<string, unknown>> = [{ type: 'text', text: textBlock }];
    for (const img of images) {
      userContent.push({ type: 'image_url', image_url: { url: img.dataUrl } });
    }

    const res = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: env.SUMMARY_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Summarization failed (${res.status}): ${detail.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content ?? '{}';
    let parsed: { title?: string; summary?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { summary: content };
    }

    return {
      title: (parsed.title || 'Conversation summary').trim(),
      body: (parsed.summary || '').trim(),
      inputTokens: json.usage?.prompt_tokens,
      outputTokens: json.usage?.completion_tokens,
    };
  }
}

export const summarizationService = new SummarizationService();
