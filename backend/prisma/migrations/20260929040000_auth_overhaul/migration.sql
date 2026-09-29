CREATE TYPE "oauth_flow" AS ENUM ('redirect', 'popup');

ALTER TABLE "oauth_states"
  ADD COLUMN "flow" "oauth_flow" NOT NULL DEFAULT 'redirect',
  ADD COLUMN "remember_me" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "auth_sessions" DROP CONSTRAINT IF EXISTS "auth_sessions_user_id_key";
ALTER TABLE "auth_sessions"
  ADD COLUMN "remember_me" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "ip" TEXT,
  ADD COLUMN "user_agent" TEXT,
  ADD COLUMN "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
