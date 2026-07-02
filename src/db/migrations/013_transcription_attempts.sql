-- ─────────────────────────────────────────────────────────────
--  Transcription retry accounting.
--
--  transcription_attempts counts how many times the worker has CLAIMED a
--  row for transcription. Claiming atomically flips the row to the
--  'processing' state and bumps this counter (see claimPendingTranscriptions
--  in message.service.ts), so an overlapping poll tick can't re-grab an
--  in-flight row and double-bill the OpenAI call. On failure the worker
--  leaves the row retryable ('pending') until the attempt cap is hit, only
--  then marking it permanently 'failed'.
--
--  The 003 partial index (WHERE transcription_status = 'pending') still
--  covers the queue; 'processing' rows drop out of it while in flight.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE messages ADD COLUMN IF NOT EXISTS transcription_attempts INT NOT NULL DEFAULT 0;
