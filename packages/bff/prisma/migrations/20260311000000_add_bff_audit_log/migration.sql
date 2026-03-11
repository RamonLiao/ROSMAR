-- CreateTable
CREATE TABLE "bff_audit_logs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bff_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bff_audit_logs_workspace_id_action_created_at_idx" ON "bff_audit_logs"("workspace_id", "action", "created_at");

-- CreateIndex
CREATE INDEX "bff_audit_logs_actor_created_at_idx" ON "bff_audit_logs"("actor", "created_at");
