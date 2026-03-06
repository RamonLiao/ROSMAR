-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sui_object_id" TEXT;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" INTEGER NOT NULL,
    "object_type" INTEGER NOT NULL,
    "object_id" TEXT NOT NULL,
    "tx_digest" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_workspace_id_object_type_object_id_idx" ON "audit_logs"("workspace_id", "object_type", "object_id");

-- CreateIndex
CREATE INDEX "audit_logs_tx_digest_idx" ON "audit_logs"("tx_digest");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
