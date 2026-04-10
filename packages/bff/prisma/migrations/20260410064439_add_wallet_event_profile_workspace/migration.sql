-- AlterTable
ALTER TABLE "quest_step_completions" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'VERIFIED';

-- AddForeignKey
ALTER TABLE "workspace_ai_configs" ADD CONSTRAINT "workspace_ai_configs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
