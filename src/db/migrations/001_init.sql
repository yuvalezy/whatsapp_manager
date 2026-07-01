-- ─────────────────────────────────────────────────────────────
--  Initial schema for WhatsApp Manager
-- ─────────────────────────────────────────────────────────────

-- Whitelisted phone numbers (normalized: digits only, no "+" or spaces).
CREATE TABLE IF NOT EXISTS whitelist (
  id           SERIAL PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  label        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stored messages from whitelisted numbers only.
CREATE TABLE IF NOT EXISTS messages (
  id            BIGSERIAL PRIMARY KEY,
  message_id    TEXT NOT NULL UNIQUE,
  chat_id       TEXT NOT NULL,
  sender_number TEXT NOT NULL,
  sender_name   TEXT,
  body          TEXT,
  message_type  TEXT NOT NULL,
  direction     TEXT NOT NULL DEFAULT 'inbound',
  timestamp     TIMESTAMPTZ NOT NULL,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender_number ON messages (sender_number);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp     ON messages (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id       ON messages (chat_id);

-- Aggregated counters for ignored messages.
-- Privacy by design: only counts per reason/day are stored, never content.
CREATE TABLE IF NOT EXISTS ignored_stats (
  id          SERIAL PRIMARY KEY,
  bucket_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason      TEXT NOT NULL,
  count       BIGINT NOT NULL DEFAULT 0,
  UNIQUE (bucket_date, reason)
);
