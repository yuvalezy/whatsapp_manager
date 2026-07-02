-- ─────────────────────────────────────────────────────────────
--  Full-text search over message content.
--
--  A STORED generated tsvector spanning the three human-readable
--  surfaces of a message — the original body, the audio transcript,
--  and the translated body — so a single query hits text regardless
--  of which form it landed in. The `'simple'` config is used (no
--  language stemming/stop-words) because threads mix languages
--  (es/en/he) and we want literal-ish matching; `to_tsvector(regconfig,
--  text)` with a literal config is IMMUTABLE, which a generated column
--  requires. A GIN index makes `@@` lookups fast.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE messages ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'simple',
      coalesce(body, '') || ' ' || coalesce(transcript, '') || ' ' || coalesce(translated_body, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_messages_search_tsv ON messages USING GIN (search_tsv);
