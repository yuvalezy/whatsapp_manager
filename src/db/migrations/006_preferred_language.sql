-- ─────────────────────────────────────────────────────────────
--  Per-contact preferred language, derived from the free offline
--  language hint already computed on every inbound message
--  (messages.detected_language). Used later to decide what
--  language to reply in. Running counters + majority vote so a
--  single ambiguous message can't flip the setting; ties default
--  to Spanish.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE whitelist
  ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'es'
    CHECK (preferred_language IN ('es', 'en', 'he')),
  ADD COLUMN IF NOT EXISTS lang_es_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lang_en_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lang_he_count INTEGER NOT NULL DEFAULT 0;

-- One-time backfill from existing message history so the feature is useful
-- immediately instead of starting every contact at 'es'/0/0/0.
UPDATE whitelist w
SET lang_es_count = counts.es,
    lang_en_count = counts.en,
    lang_he_count = counts.he,
    preferred_language = CASE
      WHEN counts.en > counts.es AND counts.en >= counts.he THEN 'en'
      WHEN counts.he > counts.es AND counts.he > counts.en THEN 'he'
      ELSE 'es'
    END
FROM (
  SELECT contact_number,
         count(*) FILTER (WHERE detected_language = 'es') AS es,
         count(*) FILTER (WHERE detected_language = 'en') AS en,
         count(*) FILTER (WHERE detected_language = 'he') AS he
  FROM messages
  WHERE direction = 'inbound'
  GROUP BY contact_number
) counts
WHERE w.phone_number = counts.contact_number;
