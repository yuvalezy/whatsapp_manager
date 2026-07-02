-- ─────────────────────────────────────────────────────────────
--  Encrypted credentials store (OpenAI, DeepSeek, future keys)
--  Plaintext is NEVER stored: each value is AES-256-GCM sealed
--  under the master key (CREDENTIALS_ENCRYPTION_KEY). Only `last4`
--  is kept in the clear for masked display.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS credentials (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  ciphertext  BYTEA NOT NULL,
  iv          BYTEA NOT NULL,
  auth_tag    BYTEA NOT NULL,
  last4       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
