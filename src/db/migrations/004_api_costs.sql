-- ─────────────────────────────────────────────────────────────
--  Per-call API cost tracking (OpenAI transcription, DeepSeek translation)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_costs (
  id             BIGSERIAL PRIMARY KEY,
  provider       TEXT NOT NULL,             -- 'openai' | 'deepseek'
  operation      TEXT NOT NULL,             -- 'transcription' | 'translation'
  message_id     BIGINT REFERENCES messages(id) ON DELETE SET NULL,
  audio_seconds  NUMERIC,                   -- set for transcription calls
  input_tokens   INTEGER,                   -- set for translation calls
  output_tokens  INTEGER,                   -- set for translation calls
  cost_usd       NUMERIC(10,6) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_costs_provider    ON api_costs (provider);
CREATE INDEX IF NOT EXISTS idx_api_costs_created_at  ON api_costs (created_at DESC);
