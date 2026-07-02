import { env } from '../config/env';
import { resolveDeepseekKey } from '../credentials/credentials.service';
import type { StoredMessage } from '../messages/message.model';
import { PreferredLanguage } from '../whitelist/whitelist.service';

export interface DraftReplyResult {
  english: string;
  translated: string | null;
  targetLanguage: PreferredLanguage;
  inputTokens?: number;
  outputTokens?: number;
}

const LANGUAGE_LABELS: Record<PreferredLanguage, string> = {
  en: 'English',
  es: 'Spanish',
  he: 'Hebrew',
};

function messagesToContext(msgs: StoredMessage[]): string {
  return msgs
    .map((m) => {
      const dir = m.direction === 'outbound' ? 'You' : (m.sender_name || m.sender_number);
      const body = m.body || m.transcript || `[${m.message_type}]`;
      return `${dir}: ${body}`;
    })
    .join('\n');
}

class DraftReplyService {
  available(): boolean {
    return Boolean(resolveDeepseekKey());
  }

  async generate(
    contextMessages: StoredMessage[],
    userDraft: string,
    targetLanguage: PreferredLanguage,
  ): Promise<DraftReplyResult> {
    const key = resolveDeepseekKey();
    if (!key) throw new Error('No DeepSeek API key configured');

    const targetLabel = LANGUAGE_LABELS[targetLanguage] || 'Spanish';
    const needsTranslation = targetLanguage !== 'en';

    const contextBlock = contextMessages.length > 0
      ? `Here is the recent conversation:\n\n${messagesToContext(contextMessages)}`
      : 'There are no recent messages in this conversation.';

    const systemPrompt = needsTranslation
      ? `You are a helpful WhatsApp reply drafting assistant. You write natural, friendly replies based on the user's notes and the conversation context. Keep replies concise and conversational — like a real WhatsApp message, not an email. Do NOT add greetings or sign-offs unless the user's notes indicate they want them.\n\nYou will generate a reply in TWO languages:\n1. "english" — the reply in English\n2. "translated" — the same reply in natural ${targetLabel} (NOT a literal translation — write it as a native ${targetLabel} speaker would, keeping the same meaning and tone)\n\nRespond with ONLY a JSON object: {"english": "...", "translated": "..."}`
      : `You are a helpful WhatsApp reply drafting assistant. You write natural, friendly replies based on the user's notes and the conversation context. Keep replies concise and conversational — like a real WhatsApp message, not an email. Do NOT add greetings or sign-offs unless the user's notes indicate they want them.\n\nGenerate the reply in English.\n\nRespond with ONLY a JSON object: {"english": "..."}`;

    const res = await fetch(`${env.DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: env.TRANSLATION_MODEL,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${contextBlock}\n\nUser's notes for the reply: ${userDraft}` },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Draft reply generation failed (${res.status}): ${detail.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content ?? '{}';
    let parsed: { english?: string; translated?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { english: content };
    }

    return {
      english: parsed.english ?? '',
      translated: needsTranslation ? (parsed.translated ?? null) : null,
      targetLanguage,
      inputTokens: json.usage?.prompt_tokens,
      outputTokens: json.usage?.completion_tokens,
    };
  }
}

export const draftReplyService = new DraftReplyService();
