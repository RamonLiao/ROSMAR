-- AlterTable (vault_secrets already created in 20260305154540_add_p2_tables)
ALTER TABLE "vault_secrets" ADD COLUMN "seal_policy_id" TEXT;
ALTER TABLE "vault_secrets" ADD COLUMN "vault_type" TEXT NOT NULL DEFAULT 'note';
ALTER TABLE "vault_secrets" ADD COLUMN "file_name" TEXT;
ALTER TABLE "vault_secrets" ADD COLUMN "mime_type" TEXT;
ALTER TABLE "vault_secrets" ADD COLUMN "file_size" INTEGER;
ALTER TABLE "vault_secrets" ADD COLUMN "sui_object_id" TEXT;
ALTER TABLE "vault_secrets" ADD COLUMN "expires_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "vault_access_logs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "secret_id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_documents" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "walrus_blob_id" TEXT NOT NULL,
    "seal_policy_id" TEXT,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "uploaded_by" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vault_access_logs_workspace_id_secret_id_idx" ON "vault_access_logs"("workspace_id", "secret_id");

-- CreateIndex
CREATE INDEX "vault_access_logs_actor_idx" ON "vault_access_logs"("actor");

-- CreateIndex
CREATE INDEX "deal_documents_deal_id_idx" ON "deal_documents"("deal_id");

-- AddForeignKey
ALTER TABLE "vault_access_logs" ADD CONSTRAINT "vault_access_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_documents" ADD CONSTRAINT "deal_documents_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
