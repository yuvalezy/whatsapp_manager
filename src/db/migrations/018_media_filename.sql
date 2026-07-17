-- ─────────────────────────────────────────────────────────────
--  Preserve the original attachment filename.
--  Document attachments (e.g. an .xlsx) carry a real filename from
--  WhatsApp, but it was only ever used to derive the on-disk extension
--  and then discarded — so downloads landed as `media` / `.bin` with no
--  usable name. Store it so the serving endpoint can advertise it via
--  Content-Disposition and the UI can show it. Nullable: most media
--  (images/audio/video/stickers) carry no meaningful filename.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_filename TEXT;
