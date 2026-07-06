ALTER TABLE whitelist
  ADD COLUMN gender TEXT NOT NULL DEFAULT 'unknown'
    CHECK (gender IN ('male', 'female', 'unknown'));
