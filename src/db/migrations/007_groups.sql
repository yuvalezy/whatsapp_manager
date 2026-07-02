-- ─────────────────────────────────────────────────────────────
--  Monitored WhatsApp group conversations.
--  A group is captured ONLY when present in this registry (explicit
--  opt-in, mirroring the whitelist). Groups can be linked to an EZY
--  Portal business partner WITHOUT a contact, so the contact columns
--  are nullable (unlike the whitelist link, where a contact is required).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS groups (
  id            SERIAL PRIMARY KEY,
  group_id      TEXT NOT NULL UNIQUE,     -- normalized group id (digits of the @g.us jid)
  chat_id       TEXT NOT NULL,            -- full jid, e.g. 120363…@g.us
  subject       TEXT,                     -- group name/subject at add time
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ezy_bp_id        UUID,
  ezy_bp_code      TEXT,
  ezy_bp_name      TEXT,
  ezy_contact_id   UUID,                  -- nullable — groups link to a BP without a contact
  ezy_contact_name TEXT,                  -- nullable
  ezy_linked_at    TIMESTAMPTZ
);
