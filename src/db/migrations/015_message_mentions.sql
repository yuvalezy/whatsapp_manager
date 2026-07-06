-- ─────────────────────────────────────────────────────────────
--  @mentions captured from group message bodies.
--
--  Each element: { id, number, name }
--    id     — raw mention digits, matches the body's literal "@<id>"
--              placeholder (normalizeNumber of the mentioned jid).
--    number — the resolved real phone number (LID-aware, via
--              lid-resolver.ts), used to cross-reference the whitelist.
--    name   — the WhatsApp-reported display name at capture time
--              (pushname/name/verifiedName), same convention as
--              sender_name: resolved once, frozen thereafter.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE messages ADD COLUMN mentions JSONB;
