import { env } from '../config/env';
import { resolveDeepseekKey } from '../credentials/credentials.service';
import type { StoredMessage } from '../messages/message.model';
import { Gender, PreferredLanguage } from '../whitelist/whitelist.service';

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

const GENDER_LABELS: Record<Exclude<Gender, 'unknown'>, string> = {
  male: 'male',
  female: 'female',
};

/**
 * Gendered languages (e.g. Spanish, Hebrew) inflect adjectives/verbs for BOTH
 * the first-person speaker and any second-person reference to the recipient —
 * these are independent and must not be conflated. `env.OWN_GENDER` is the
 * account owner (the "source" — always the same person, set once); the
 * whitelist contact's `gender` is the "target" (per-conversation, may be
 * unknown). Without this split, a model given only the recipient's gender has
 * been observed inferring the speaker shares it (e.g. writing as a woman
 * addressing a woman when the actual sender is male).
 */
function buildGenderNote(ownGender: Gender | undefined, recipientGender: Gender | null | undefined): string {
  const own = ownGender && ownGender !== 'unknown' ? GENDER_LABELS[ownGender] : null;
  const recipient = recipientGender && recipientGender !== 'unknown' ? GENDER_LABELS[recipientGender] : null;

  if (own && recipient) {
    return ` The person you are writing AS (the speaker, first-person "I"/"me") is ${own}. The person you are writing TO (the recipient, addressed as "you") is ${recipient}. These are two different people — do not assume they share a gender. Use grammatically correct gendered language (adjectives, verb agreement, titles) for each independently.`;
  }
  if (own) {
    return ` The person you are writing AS (the speaker, first-person "I"/"me") is ${own} — use grammatically correct gendered language for the speaker's own voice accordingly.`;
  }
  if (recipient) {
    return ` The person you are writing TO (the recipient, addressed as "you") is ${recipient} — use grammatically correct gendered language when addressing or describing them accordingly. This says nothing about the speaker's own gender.`;
  }
  return '';
}

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
    recipientGender?: Gender | null,
  ): Promise<DraftReplyResult> {
    const key = resolveDeepseekKey();
    if (!key) throw new Error('No DeepSeek API key configured');

    const targetLabel = LANGUAGE_LABELS[targetLanguage] || 'Spanish';
    const needsTranslation = targetLanguage !== 'en';

    const contextBlock = contextMessages.length > 0
      ? `Here is the recent conversation:\n\n${messagesToContext(contextMessages)}`
      : 'There are no recent messages in this conversation.';

    const genderNote = buildGenderNote(env.OWN_GENDER, recipientGender);

    const systemPrompt = needsTranslation
      ? `You are a helpful WhatsApp reply drafting assistant. You write natural, friendly replies based on the user's notes and the conversation context. Keep replies concise and conversational — like a real WhatsApp message, not an email. Do NOT add greetings or sign-offs unless the user's notes indicate they want them.${genderNote}\n\nYou will generate a reply in TWO languages:\n1. "english" — the reply in English\n2. "translated" — the same reply in natural ${targetLabel} (NOT a literal translation — write it as a native ${targetLabel} speaker would, keeping the same meaning and tone)\n\nRespond with ONLY a JSON object: {"english": "...", "translated": "..."}`
      : `You are a helpful WhatsApp reply drafting assistant. You write natural, friendly replies based on the user's notes and the conversation context. Keep replies concise and conversational — like a real WhatsApp message, not an email. Do NOT add greetings or sign-offs unless the user's notes indicate they want them.${genderNote}\n\nGenerate the reply in English.\n\nRespond with ONLY a JSON object: {"english": "..."}`;

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
