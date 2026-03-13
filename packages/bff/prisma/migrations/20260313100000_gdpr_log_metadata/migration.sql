-- Add metadata column to gdpr_deletion_logs for Seal policy audit trail
ALTER TABLE "gdpr_deletion_logs" ADD COLUMN "metadata" JSONB;
