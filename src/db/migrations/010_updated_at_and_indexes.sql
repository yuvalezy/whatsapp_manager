-- ─────────────────────────────────────────────────────────────
--  updated_at watermark + hot-path indexes for the inbox.
--
--  • updated_at   — auto-stamped on every UPDATE via a BEFORE UPDATE
--                   trigger, so ALL mutations (setTranscription,
--                   setTranslation, updateAck, markDeleted, updateBody…)
--                   are timestamped without touching each writer.
--                   Powers incremental sync (`GET /messages?updated_since=`).
--  • idx_messages_contact_ts     — composite (contact_number, timestamp DESC)
--                   for listThreads' DISTINCT ON + every thread scan.
--  • idx_messages_contact_unread — partial index for getUnreadCounts, which
--                   only ever scans inbound rows.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION messages_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_messages_updated_at ON messages;
CREATE TRIGGER trg_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION messages_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_messages_contact_ts
  ON messages (contact_number, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_messages_contact_unread
  ON messages (contact_number) WHERE direction = 'inbound';
