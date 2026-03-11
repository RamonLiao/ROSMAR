-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "gdpr_completed_at" TIMESTAMP(3),
ADD COLUMN     "gdpr_scheduled_at" TIMESTAMP(3),
ADD COLUMN     "gdpr_status" TEXT NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "workflow_action_logs" ADD COLUMN     "metadata" JSONB;

-- CreateTable
CREATE TABLE "llm_usage_logs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "agent_type" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_tokens" INTEGER NOT NULL,
    "completion_tokens" INTEGER NOT NULL,
    "estimated_cost_usd" DECIMAL(10,6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_ai_configs" (
    "workspace_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'anthropic',
    "api_key_encrypted" TEXT,
    "monthly_quota_usd" DECIMAL(10,2) NOT NULL DEFAULT 10,
    "used_quota_usd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quota_reset_at" TIMESTAMP(3) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "workspace_ai_configs_pkey" PRIMARY KEY ("workspace_id")
);

-- CreateTable
CREATE TABLE "campaign_triggers" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "trigger_config" JSONB NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "campaign_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_wallets" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "ens_name" TEXT,
    "sns_name" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_links" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platform_user_id" TEXT NOT NULL,
    "platform_username" TEXT,
    "oauth_token_encrypted" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcasts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "content_html" TEXT,
    "channels" JSONB NOT NULL,
    "segment_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_deliveries" (
    "id" TEXT NOT NULL,
    "broadcast_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "platform_message_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcast_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrows" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "sui_object_id" TEXT,
    "payer" TEXT NOT NULL,
    "payee" TEXT NOT NULL,
    "token_type" TEXT NOT NULL DEFAULT 'SUI',
    "total_amount" DECIMAL(65,30) NOT NULL,
    "released_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "refunded_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT 'CREATED',
    "arbiter_threshold" INTEGER NOT NULL DEFAULT 1,
    "expiry_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "escrows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vesting_schedules" (
    "id" TEXT NOT NULL,
    "escrow_id" TEXT NOT NULL,
    "vesting_type" TEXT NOT NULL,
    "cliff_ms" BIGINT NOT NULL DEFAULT 0,
    "total_duration_ms" BIGINT NOT NULL DEFAULT 0,
    "start_time" TIMESTAMP(3),
    "milestones" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "vesting_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_arbitrators" (
    "id" TEXT NOT NULL,
    "escrow_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,

    CONSTRAINT "escrow_arbitrators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saft_templates" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "escrow_id" TEXT,
    "name" TEXT NOT NULL,
    "terms" JSONB NOT NULL,
    "walrus_blob_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saft_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quests" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "reward_type" TEXT NOT NULL DEFAULT 'BADGE',
    "reward_config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quest_steps" (
    "id" TEXT NOT NULL,
    "quest_id" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "action_type" TEXT NOT NULL,
    "action_config" JSONB NOT NULL DEFAULT '{}',
    "verification_method" TEXT NOT NULL DEFAULT 'INDEXER',
    "chain" TEXT NOT NULL DEFAULT 'SUI',

    CONSTRAINT "quest_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quest_completions" (
    "id" TEXT NOT NULL,
    "quest_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "badge_sui_id" TEXT,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quest_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quest_step_completions" (
    "id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "tx_digest" TEXT,
    "verified_by" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quest_step_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lookalike_results" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "seed_segment_id" TEXT NOT NULL,
    "result_segment_id" TEXT,
    "top_k" INTEGER NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'knn-cosine',
    "centroid" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lookalike_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gdpr_deletion_logs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "legal_basis" TEXT NOT NULL,
    "data_categories" JSONB NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "executed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gdpr_deletion_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "llm_usage_logs_workspace_id_created_at_idx" ON "llm_usage_logs"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "campaign_triggers_trigger_type_is_enabled_idx" ON "campaign_triggers"("trigger_type", "is_enabled");

-- CreateIndex
CREATE INDEX "profile_wallets_address_idx" ON "profile_wallets"("address");

-- CreateIndex
CREATE UNIQUE INDEX "profile_wallets_profile_id_chain_address_key" ON "profile_wallets"("profile_id", "chain", "address");

-- CreateIndex
CREATE INDEX "social_links_platform_platform_user_id_idx" ON "social_links"("platform", "platform_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_links_profile_id_platform_key" ON "social_links"("profile_id", "platform");

-- CreateIndex
CREATE INDEX "broadcasts_workspace_id_status_idx" ON "broadcasts"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "broadcast_deliveries_broadcast_id_channel_idx" ON "broadcast_deliveries"("broadcast_id", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "vesting_schedules_escrow_id_key" ON "vesting_schedules"("escrow_id");

-- CreateIndex
CREATE UNIQUE INDEX "escrow_arbitrators_escrow_id_address_key" ON "escrow_arbitrators"("escrow_id", "address");

-- CreateIndex
CREATE UNIQUE INDEX "quest_completions_quest_id_profile_id_key" ON "quest_completions"("quest_id", "profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "quest_step_completions_step_id_profile_id_key" ON "quest_step_completions"("step_id", "profile_id");

-- AddForeignKey
ALTER TABLE "campaign_triggers" ADD CONSTRAINT "campaign_triggers_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_wallets" ADD CONSTRAINT "profile_wallets_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_links" ADD CONSTRAINT "social_links_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_deliveries" ADD CONSTRAINT "broadcast_deliveries_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrows" ADD CONSTRAINT "escrows_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrows" ADD CONSTRAINT "escrows_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vesting_schedules" ADD CONSTRAINT "vesting_schedules_escrow_id_fkey" FOREIGN KEY ("escrow_id") REFERENCES "escrows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_arbitrators" ADD CONSTRAINT "escrow_arbitrators_escrow_id_fkey" FOREIGN KEY ("escrow_id") REFERENCES "escrows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saft_templates" ADD CONSTRAINT "saft_templates_escrow_id_fkey" FOREIGN KEY ("escrow_id") REFERENCES "escrows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saft_templates" ADD CONSTRAINT "saft_templates_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quests" ADD CONSTRAINT "quests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_steps" ADD CONSTRAINT "quest_steps_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "quests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_completions" ADD CONSTRAINT "quest_completions_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "quests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_completions" ADD CONSTRAINT "quest_completions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_step_completions" ADD CONSTRAINT "quest_step_completions_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "quest_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lookalike_results" ADD CONSTRAINT "lookalike_results_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lookalike_results" ADD CONSTRAINT "lookalike_results_seed_segment_id_fkey" FOREIGN KEY ("seed_segment_id") REFERENCES "segments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lookalike_results" ADD CONSTRAINT "lookalike_results_result_segment_id_fkey" FOREIGN KEY ("result_segment_id") REFERENCES "segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gdpr_deletion_logs" ADD CONSTRAINT "gdpr_deletion_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
