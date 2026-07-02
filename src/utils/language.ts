/**
 * Cheap, offline language *hint* for a piece of text.
 *
 * This is deliberately free (no API call): it tags obvious scripts so a message
 * is queryable right after capture. It is NOT authoritative — on-demand
 * translation asks DeepSeek for the real source language and overwrites
 * `detected_language`. Latin-script text can't be reliably split into es/en
 * offline, so we use a light Spanish heuristic and otherwise assume English.
 *
 * Returns an ISO-639-1 code, or `'und'` when there's nothing to go on.
 */
export function detectLanguageHint(text: string | null | undefined): string {
  if (!text) return 'und';
  const t = text.trim();
  if (!t) return 'und';

  if (/[֐-׿]/.test(t)) return 'he'; // Hebrew
  if (/[؀-ۿ]/.test(t)) return 'ar'; // Arabic
  if (/[Ѐ-ӿ]/.test(t)) return 'ru'; // Cyrillic
  if (/[一-鿿]/.test(t)) return 'zh'; // CJK

  // Latin script — light Spanish signal, else default to English.
  if (
    /[ñ¿¡]/i.test(t) ||
    /\b(el|la|los|las|una|pero|porque|gracias|hola|qué|está|también|mañana|buenos|días|noches)\b/i.test(
      t,
    )
  ) {
    return 'es';
  }
  return 'en';
}
