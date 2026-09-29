-- AlterTable
ALTER TABLE "users" ADD COLUMN "marketing_consent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "signup_source" TEXT;
