CREATE TYPE "subscription_plan" AS ENUM ('inventory', 'gym', 'bundle', 'trial');
CREATE TYPE "subscription_status" AS ENUM ('pending', 'active', 'past_due', 'cancelled', 'expired');
CREATE TYPE "orvio_app" AS ENUM ('inventory', 'gym');

ALTER TABLE "organizations"
  ADD COLUMN "default_app" "orvio_app" NOT NULL DEFAULT 'inventory';
ALTER TABLE "auth_sessions"
  ADD COLUMN "active_org_id" UUID;

CREATE TABLE "organization_invitations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "accepted_at" TIMESTAMPTZ(6),
  "invited_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organization_invitations_token_hash_key" ON "organization_invitations"("token_hash");
CREATE INDEX "organization_invitations_org_id_email_idx" ON "organization_invitations"("org_id", "email");

CREATE TABLE "organization_subscriptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL,
  "plan" "subscription_plan" NOT NULL,
  "status" "subscription_status" NOT NULL DEFAULT 'pending',
  "provider_reference" TEXT,
  "provider_plan_code" TEXT,
  "current_period_end" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organization_subscriptions_provider_reference_key" ON "organization_subscriptions"("provider_reference");
CREATE INDEX "organization_subscriptions_org_id_status_idx" ON "organization_subscriptions"("org_id", "status");

CREATE TABLE "organization_entitlements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL,
  "app" "orvio_app" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "expires_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_entitlements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organization_entitlements_org_id_app_key" ON "organization_entitlements"("org_id", "app");
CREATE INDEX "organization_entitlements_org_id_enabled_expires_at_idx" ON "organization_entitlements"("org_id", "enabled", "expires_at");

ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_active_org_id_fkey" FOREIGN KEY ("active_org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_entitlements" ADD CONSTRAINT "organization_entitlements_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
