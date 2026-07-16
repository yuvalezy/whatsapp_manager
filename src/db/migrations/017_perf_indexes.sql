-- ─────────────────────────────────────────────────────────────
--  Indexes for the two message-list access paths that were
--  scanning:
--
--  • updated_at — GET /messages?updated_since=… (the external
--    agent's incremental pull) filters `updated_at > $1` on every
--    poll; without this it's a full-table scan that grows with
--    history.
--
--  • message_type — GET /messages?type=… and the search page's
--    type filter. Low-ish cardinality but selective for the
--    interesting values (ptt, image, document ≪ chat).
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_messages_updated_at
  ON messages (updated_at);

CREATE INDEX IF NOT EXISTS idx_messages_message_type
  ON messages (message_type);
