-- ─────────────────────────────────────────────────────────────
--  Full-thread capture, media archival, transcription & translation
--  Extends `messages` with:
--   • contact_number  — the OTHER party (thread key for both directions)
--   • media_*         — locally-downloaded attachment metadata
--   • detected_language / transcript* / translated_* — enrichment
--  All columns nullable; one media per WhatsApp message ⇒ flat columns.
-- ─────────────────────────────────────────────────────────────

-- Threading key: the contact on the other side of the conversation.
-- inbound  → the sender; outbound → the recipient.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS contact_number TEXT;
UPDATE messages SET contact_number = sender_number WHERE contact_number IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_contact_number ON messages (contact_number);

-- Locally-archived attachment (image/audio/voice/video/document/sticker).
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_type     TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_path     TEXT;    -- relative to MEDIA_STORAGE_PATH
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_mimetype TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_filesize BIGINT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_status   TEXT NOT NULL DEFAULT 'none';
  -- none | pending | downloaded | failed | expired

-- Language detection + transcription (original) + translation (English).
ALTER TABLE messages ADD COLUMN IF NOT EXISTS detected_language     TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS transcript            TEXT;  -- audio, original language
ALTER TABLE messages ADD COLUMN IF NOT EXISTS transcript_language   TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS transcript_translated TEXT;  -- audio, English
ALTER TABLE messages ADD COLUMN IF NOT EXISTS transcription_status  TEXT NOT NULL DEFAULT 'none';
  -- none | pending | done | failed
ALTER TABLE messages ADD COLUMN IF NOT EXISTS translated_body       TEXT;  -- text body, English
ALTER TABLE messages ADD COLUMN IF NOT EXISTS translation_status    TEXT NOT NULL DEFAULT 'none';
  -- none | pending | done | failed | skipped

-- Partial index so the transcription worker polls only what's pending.
CREATE INDEX IF NOT EXISTS idx_messages_transcription_pending
  ON messages (id) WHERE transcription_status = 'pending';
