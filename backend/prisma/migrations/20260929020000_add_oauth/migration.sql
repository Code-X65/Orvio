CREATE TYPE "oauth_provider" AS ENUM ('google', 'facebook');
CREATE TYPE "oauth_purpose" AS ENUM ('sign_in', 'link');

CREATE TABLE "oauth_identities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "provider" "oauth_provider" NOT NULL,
  "provider_subject" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_identities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_states" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "token_hash" TEXT NOT NULL,
  "provider" "oauth_provider" NOT NULL,
  "purpose" "oauth_purpose" NOT NULL,
  "user_id" UUID,
  "nonce" TEXT,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "used_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauth_identities_provider_provider_subject_key" ON "oauth_identities"("provider", "provider_subject");
CREATE UNIQUE INDEX "oauth_identities_user_id_provider_key" ON "oauth_identities"("user_id", "provider");
CREATE INDEX "oauth_identities_user_id_idx" ON "oauth_identities"("user_id");
CREATE UNIQUE INDEX "oauth_states_token_hash_key" ON "oauth_states"("token_hash");
CREATE INDEX "oauth_states_user_id_expires_at_idx" ON "oauth_states"("user_id", "expires_at");

ALTER TABLE "oauth_identities" ADD CONSTRAINT "oauth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
