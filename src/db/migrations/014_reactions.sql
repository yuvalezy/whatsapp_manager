-- ─────────────────────────────────────────────────────────────
--  Emoji reactions on stored messages.
--
--  PRIVACY: a reaction is recorded ONLY for a message we already
--  store. This is enforced at the DB level by the FK to
--  messages(message_id) — a reaction whose target isn't stored
--  (i.e. an ignored / non-whitelisted / non-monitored-group chat)
--  is rejected, and the app drops that FK violation. Nothing about
--  ignored chats is ever persisted here.
--
--  A reaction is current-state per (message, sender): re-reacting
--  UPSERTs the row and removing a reaction deletes it, so the table
--  never accumulates stale rows as people toggle reactions.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS message_reactions (
  id            BIGSERIAL PRIMARY KEY,
  message_id    TEXT NOT NULL REFERENCES messages (message_id) ON DELETE CASCADE,
  sender_number TEXT NOT NULL,
  reaction      TEXT NOT NULL,
  timestamp     TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, sender_number)
);

-- FKs don't auto-index the referencing column; needed for lookups by message
-- and for efficient ON DELETE CASCADE.
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id
  ON message_reactions (message_id);
