-- ─────────────────────────────────────────────────────────────
--  AI-generated conversation summaries. One row per user-triggered
--  "summarize the last N minutes/hours" action, keyed by the thread
--  (contact_number = phone number for contacts, group id for groups).
--  Browsable per-thread as a history (title + timestamp → body).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS summaries (
  id             SERIAL PRIMARY KEY,
  contact_number TEXT NOT NULL,          -- thread key (phone number or group id)
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  window_minutes INTEGER NOT NULL,
  window_start   TIMESTAMPTZ NOT NULL,
  window_end     TIMESTAMPTZ NOT NULL,
  message_count  INTEGER NOT NULL DEFAULT 0,
  image_count    INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_summaries_contact ON summaries (contact_number, created_at DESC);
