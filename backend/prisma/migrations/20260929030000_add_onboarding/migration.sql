CREATE TYPE "onboarding_stage" AS ENUM ('profile', 'email_verification', 'phone_verification', 'complete');
CREATE TYPE "legal_document_type" AS ENUM ('terms', 'privacy');

ALTER TABLE "users"
  ADD COLUMN "first_name" TEXT,
  ADD COLUMN "last_name" TEXT;
ALTER TABLE "users" RENAME COLUMN "phone" TO "phone_e164";
ALTER TABLE "users"
  ALTER COLUMN "password_hash" DROP NOT NULL,
  ADD COLUMN "email_verified_at" TIMESTAMPTZ(6),
  ADD COLUMN "phone_verified_at" TIMESTAMPTZ(6),
  ADD COLUMN "password_set_at" TIMESTAMPTZ(6),
  ADD COLUMN "onboarding_completed_at" TIMESTAMPTZ(6);
CREATE UNIQUE INDEX "users_phone_e164_key" ON "users"("phone_e164") WHERE "phone_e164" IS NOT NULL;
ALTER TABLE "organizations" ADD COLUMN "country" CHAR(2);

CREATE TABLE "user_onboarding" (
  "user_id" UUID NOT NULL,
  "stage" "onboarding_stage" NOT NULL DEFAULT 'profile',
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "email_verified_at" TIMESTAMPTZ(6),
  "phone_verified_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_onboarding_pkey" PRIMARY KEY ("user_id")
);
CREATE INDEX "user_onboarding_stage_idx" ON "user_onboarding"("stage");
ALTER TABLE "user_onboarding" ADD CONSTRAINT "user_onboarding_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "legal_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" "legal_document_type" NOT NULL,
  "version" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "is_current" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "legal_documents_type_version_key" ON "legal_documents"("type", "version");
CREATE INDEX "legal_documents_type_is_current_idx" ON "legal_documents"("type", "is_current");

CREATE TABLE "legal_acceptances" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "accepted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip" TEXT,
  "user_agent" TEXT,
  CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "legal_acceptances_user_id_document_id_key" ON "legal_acceptances"("user_id", "document_id");
CREATE INDEX "legal_acceptances_user_id_accepted_at_idx" ON "legal_acceptances"("user_id", "accepted_at");
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "phone_verifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "phone" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "resend_count" INTEGER NOT NULL DEFAULT 0,
  "used_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "phone_verifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "phone_verifications_user_id_phone_expires_at_idx" ON "phone_verifications"("user_id", "phone", "expires_at");
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "rate_limit_buckets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "action" TEXT NOT NULL,
  "subject_hash" TEXT NOT NULL,
  "window_start" TIMESTAMPTZ(6) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "rate_limit_buckets_action_subject_hash_window_start_key" ON "rate_limit_buckets"("action", "subject_hash", "window_start");
CREATE INDEX "rate_limit_buckets_window_start_idx" ON "rate_limit_buckets"("window_start");
