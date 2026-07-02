-- ─────────────────────────────────────────────────────────────
--  Link a whitelisted number to an EZY Portal business partner
--  + contact. Denormalized name/code so the whitelist table can
--  render without a round trip to the portal API.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE whitelist
  ADD COLUMN IF NOT EXISTS ezy_bp_id        UUID,
  ADD COLUMN IF NOT EXISTS ezy_bp_code      TEXT,
  ADD COLUMN IF NOT EXISTS ezy_bp_name      TEXT,
  ADD COLUMN IF NOT EXISTS ezy_contact_id   UUID,
  ADD COLUMN IF NOT EXISTS ezy_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS ezy_linked_at    TIMESTAMPTZ;
