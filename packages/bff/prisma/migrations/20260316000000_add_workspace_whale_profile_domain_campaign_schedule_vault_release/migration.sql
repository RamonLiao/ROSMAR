-- AlterTable: workspaces
ALTER TABLE "workspaces" ADD COLUMN "collection_watchlist" JSONB;
ALTER TABLE "workspaces" ADD COLUMN "whale_thresholds" JSONB;

-- AlterTable: profiles
ALTER TABLE "profiles" ADD COLUMN "avatar_url" TEXT;
ALTER TABLE "profiles" ADD COLUMN "primary_domain" TEXT;

-- AlterTable: campaigns
ALTER TABLE "campaigns" ADD COLUMN "scheduled_at" TIMESTAMP(3);

-- AlterTable: vault_secrets
ALTER TABLE "vault_secrets" ADD COLUMN "release_at" TIMESTAMP(3);
ALTER TABLE "vault_secrets" ADD COLUMN "is_released" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "vault_secrets_is_released_release_at_idx" ON "vault_secrets"("is_released", "release_at");
