-- CreateTable
CREATE TABLE "wallet_events" (
    "id" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "address" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "collection" TEXT,
    "token" TEXT,
    "amount" DECIMAL(36,18),
    "tx_digest" TEXT NOT NULL,
    "contract_address" TEXT,
    "raw_data" JSONB,
    "profile_id" TEXT,
    "workspace_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement_snapshots" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engagement_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wallet_events_address_time_idx" ON "wallet_events"("address", "time");

-- CreateIndex
CREATE INDEX "wallet_events_profile_id_event_type_idx" ON "wallet_events"("profile_id", "event_type");

-- CreateIndex
CREATE INDEX "wallet_events_workspace_id_time_idx" ON "wallet_events"("workspace_id", "time");

-- CreateIndex
CREATE INDEX "wallet_events_tx_digest_idx" ON "wallet_events"("tx_digest");

-- CreateIndex
CREATE INDEX "engagement_snapshots_profile_id_calculated_at_idx" ON "engagement_snapshots"("profile_id", "calculated_at");

-- CreateIndex
CREATE INDEX "engagement_snapshots_workspace_id_calculated_at_idx" ON "engagement_snapshots"("workspace_id", "calculated_at");
