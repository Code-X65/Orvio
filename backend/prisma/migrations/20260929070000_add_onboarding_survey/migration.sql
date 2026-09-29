CREATE TABLE "onboarding_responses" (
  "user_id" UUID NOT NULL,
  "answers_json" JSONB,
  "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed" BOOLEAN NOT NULL DEFAULT FALSE,
  "skipped_session_family_id" UUID,
  CONSTRAINT "onboarding_responses_pkey" PRIMARY KEY ("user_id")
);

CREATE INDEX "onboarding_responses_completed_idx" ON "onboarding_responses"("completed");

ALTER TABLE "onboarding_responses"
  ADD CONSTRAINT "onboarding_responses_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
