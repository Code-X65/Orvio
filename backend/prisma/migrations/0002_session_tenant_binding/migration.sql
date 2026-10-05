ALTER TABLE "refresh_tokens"
  ADD COLUMN "org_id" TEXT,
  ADD COLUMN "membership_id" TEXT;

CREATE INDEX "refresh_tokens_membership_id_idx" ON "refresh_tokens"("membership_id");

ALTER TABLE "refresh_tokens"
  ADD COLUMN "session_id" TEXT,
  ADD COLUMN "absolute_expires_at" TIMESTAMP(3),
  ADD COLUMN "last_used_at" TIMESTAMP(3),
  ADD COLUMN "created_ip" TEXT,
  ADD COLUMN "user_agent" TEXT;

CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens"("session_id");
