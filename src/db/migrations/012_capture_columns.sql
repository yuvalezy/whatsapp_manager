-- ─────────────────────────────────────────────────────────────
--  Message-lifecycle capture columns.
--
--  • reply_to_message_id — the WhatsApp message_id this one quotes/replies
--                          to (nullable; set at ingestion from the quoted msg).
--  • edited_at           — set when a captured message's body is edited
--                          in place (WhatsApp "edit message").
--  • is_deleted / deleted_at — soft-delete flag + timestamp set when the
--                          sender revokes ("delete for everyone") a captured
--                          message. Content is retained; the flag lets the
--                          UI/agent present it as withdrawn.
--
--  All nullable / defaulted so existing rows are untouched.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_message_id TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at            TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted           BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at           TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages (reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;
