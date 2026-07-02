-- ─────────────────────────────────────────────────────────────
--  Per-conversation read state + per-message delivery ack.
--
--  conversation_reads: a single "last read" watermark per thread,
--  keyed by the same thread id used everywhere else — a phone
--  number for 1:1 contacts, a group id for monitored groups (both
--  normalized digit strings, same namespace as messages.contact_number).
--  Powers the unread badge and the "mark as read" (WhatsApp sendSeen)
--  action.
--
--  messages.ack: WhatsApp delivery state for OUTBOUND messages
--  (whatsapp-web.js MessageAck): -1 error, 0 pending, 1 sent (✓),
--  2 delivered (✓✓), 3 read (✓✓ blue), 4 played. Updated live via
--  the client 'message_ack' event.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversation_reads (
  thread_id    TEXT PRIMARY KEY,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS ack SMALLINT;
