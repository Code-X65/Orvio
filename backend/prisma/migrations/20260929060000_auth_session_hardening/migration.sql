ALTER TABLE auth_sessions
  ADD COLUMN IF NOT EXISTS family_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS parent_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS absolute_expires_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS auth_sessions_family_id_idx ON auth_sessions(family_id);
CREATE INDEX IF NOT EXISTS auth_sessions_parent_token_hash_idx ON auth_sessions(parent_token_hash);
