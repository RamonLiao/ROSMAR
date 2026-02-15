-- ===================================
-- ROSMAR CRM - Initial Schema
-- Migration: 001
-- ===================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===================================
-- REGULAR TABLES
-- ===================================

-- Workspaces (tenants)
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sui_object_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    owner_address TEXT NOT NULL,
    plan TEXT DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Workspace members
CREATE TABLE workspace_members (
    workspace_id UUID REFERENCES workspaces(id),
    address TEXT NOT NULL,
    role_level SMALLINT NOT NULL DEFAULT 0,
    permissions BIGINT NOT NULL DEFAULT 1,
    joined_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (workspace_id, address)
);

-- Customer profiles
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    sui_object_id TEXT UNIQUE,
    primary_address TEXT NOT NULL,
    suins_name TEXT,
    tier SMALLINT DEFAULT 0,
    engagement_score BIGINT DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    display_name TEXT,
    avatar_url TEXT,
    last_active_at TIMESTAMPTZ,
    source TEXT,
    walrus_blob_id TEXT,
    seal_policy_id TEXT,
    version BIGINT DEFAULT 0,                  -- optimistic lock
    is_archived BOOLEAN DEFAULT false,         -- soft delete
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(workspace_id, primary_address)
);

-- Full-text search support for profiles
ALTER TABLE profiles ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('simple',
            coalesce(display_name, '') || ' ' ||
            coalesce(suins_name, '') || ' ' ||
            coalesce(primary_address, '') || ' ' ||
            coalesce(array_to_string(tags, ' '), '')
        )
    ) STORED;

CREATE INDEX idx_profiles_search ON profiles USING GIN(search_vector);
CREATE INDEX idx_profiles_workspace_tier ON profiles(workspace_id, tier);
CREATE INDEX idx_profiles_workspace_score ON profiles(workspace_id, engagement_score DESC);
CREATE INDEX idx_profiles_tags ON profiles USING GIN(tags);

-- Wallet bindings (multi-wallet support)
CREATE TABLE wallet_bindings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    chain TEXT NOT NULL,                      -- "sui", "evm", "solana"
    added_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(profile_id, address)
);

CREATE INDEX idx_wallet_bindings_address ON wallet_bindings(address);
CREATE INDEX idx_wallet_bindings_profile ON wallet_bindings(profile_id);

-- Organizations / DAOs / Projects
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    sui_object_id TEXT UNIQUE,
    name TEXT NOT NULL,
    org_type SMALLINT DEFAULT 0,               -- 0=company, 1=dao, 2=protocol, 3=nft_project
    primary_address TEXT,
    tags TEXT[] DEFAULT '{}',
    walrus_blob_id TEXT,
    seal_policy_id TEXT,
    version BIGINT DEFAULT 0,
    is_archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_organizations_workspace ON organizations(workspace_id);
CREATE INDEX idx_organizations_type ON organizations(org_type);

-- Profile <-> Organization relations
CREATE TABLE profile_org_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role_label TEXT NOT NULL,                  -- "Founder", "Investor", "Advisor"
    since TIMESTAMPTZ DEFAULT now(),
    UNIQUE(workspace_id, profile_id, org_id)
);

CREATE INDEX idx_profile_org_links_profile ON profile_org_links(profile_id);
CREATE INDEX idx_profile_org_links_org ON profile_org_links(org_id);

-- Deals (sales pipeline)
CREATE TABLE deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    sui_object_id TEXT UNIQUE,
    title TEXT NOT NULL,
    stage SMALLINT DEFAULT 0,                  -- 0=new, 1=qualified, 2=proposal, 3=won, 4=lost
    value_token TEXT,
    value_amount BIGINT DEFAULT 0,
    assignee_address TEXT,
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    walrus_blob_id TEXT,
    seal_policy_id TEXT,
    expected_close_date DATE,
    version BIGINT DEFAULT 0,
    is_archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_deals_workspace ON deals(workspace_id);
CREATE INDEX idx_deals_pipeline ON deals(workspace_id, stage) WHERE NOT is_archived;
CREATE INDEX idx_deals_profile ON deals(profile_id);
CREATE INDEX idx_deals_org ON deals(org_id);

-- Tickets (support tickets)
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    status SMALLINT DEFAULT 0,                 -- 0=open, 1=in_progress, 2=resolved, 3=closed
    priority SMALLINT DEFAULT 1,               -- 0=low, 1=normal, 2=high, 3=urgent
    assignee_address TEXT,
    source TEXT,                               -- "email", "telegram", "discord", "web"
    sla_deadline TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tickets_workspace ON tickets(workspace_id);
CREATE INDEX idx_tickets_status ON tickets(workspace_id, status);
CREATE INDEX idx_tickets_profile ON tickets(profile_id);
CREATE INDEX idx_tickets_sla ON tickets(sla_deadline) WHERE status < 2;

-- Segments (customer segments)
CREATE TABLE segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    sui_object_id TEXT UNIQUE,
    name TEXT NOT NULL,
    rules JSONB NOT NULL,
    rule_hash TEXT NOT NULL,
    is_dynamic BOOLEAN DEFAULT true,
    member_count INT DEFAULT 0,
    last_evaluated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_segments_workspace ON segments(workspace_id);
CREATE INDEX idx_segments_rules ON segments USING GIN(rules);

-- Segment membership
CREATE TABLE segment_members (
    segment_id UUID REFERENCES segments(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (segment_id, profile_id)
);

CREATE INDEX idx_segment_members_profile ON segment_members(profile_id);

-- Campaigns
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    sui_object_id TEXT UNIQUE,
    name TEXT NOT NULL,
    segment_id UUID REFERENCES segments(id) ON DELETE SET NULL,
    status SMALLINT DEFAULT 0,                 -- 0=draft, 1=active, 2=paused, 3=completed
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    reward_type SMALLINT,                      -- 0=token, 1=nft, 2=role, 3=none
    message_template JSONB,
    stats JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_campaigns_workspace ON campaigns(workspace_id);
CREATE INDEX idx_campaigns_status ON campaigns(workspace_id, status);
CREATE INDEX idx_campaigns_segment ON campaigns(segment_id);

-- Campaign actions (tracking)
CREATE TABLE campaign_actions (
    id BIGSERIAL PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,                 -- "sent", "opened", "clicked", "converted"
    metadata JSONB,
    executed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_campaign_actions_campaign ON campaign_actions(campaign_id);
CREATE INDEX idx_campaign_actions_profile ON campaign_actions(profile_id);

-- Vault entries (encrypted data pointers)
CREATE TABLE vault_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    entry_type TEXT NOT NULL,                  -- "note", "file"
    title TEXT NOT NULL,
    walrus_blob_id TEXT NOT NULL,
    seal_policy_id TEXT,
    file_size BIGINT,
    mime_type TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vault_entries_workspace ON vault_entries(workspace_id);
CREATE INDEX idx_vault_entries_profile ON vault_entries(profile_id);
CREATE INDEX idx_vault_entries_org ON vault_entries(org_id);
CREATE INDEX idx_vault_entries_deal ON vault_entries(deal_id);
CREATE INDEX idx_vault_entries_type ON vault_entries(entry_type);

-- Audit logs
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    actor_address TEXT NOT NULL,
    action SMALLINT NOT NULL,                  -- 0=create, 1=update, 2=delete, 3=share, 4=revoke, 5=archive
    object_type SMALLINT NOT NULL,             -- 0=profile, 1=org, 2=deal, 3=segment, 4=campaign, 5=vault
    object_id TEXT NOT NULL,
    tx_hash TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_workspace_time ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX idx_audit_object ON audit_logs(object_type, object_id);
CREATE INDEX idx_audit_actor ON audit_logs(actor_address, created_at DESC);

-- ===================================
-- TIMESCALEDB HYPERTABLES
-- ===================================

-- Wallet events (time-series)
CREATE TABLE wallet_events (
    time TIMESTAMPTZ NOT NULL,
    workspace_id UUID,
    address TEXT NOT NULL,
    profile_id UUID,
    event_type TEXT NOT NULL,                  -- "mint", "transfer", "burn", "swap", "stake", etc.
    contract_address TEXT,
    collection TEXT,
    token TEXT,
    amount BIGINT DEFAULT 0,
    tx_digest TEXT NOT NULL,
    raw_data JSONB,
    PRIMARY KEY (time, tx_digest, address)
);

SELECT create_hypertable('wallet_events', 'time');

CREATE INDEX idx_events_profile ON wallet_events(profile_id, time DESC);
CREATE INDEX idx_events_workspace ON wallet_events(workspace_id, time DESC);
CREATE INDEX idx_events_type ON wallet_events(event_type, time DESC);
CREATE INDEX idx_events_type_collection ON wallet_events(event_type, collection, time DESC);
CREATE INDEX idx_events_address ON wallet_events(address, time DESC);

-- Engagement snapshots (time-series)
CREATE TABLE engagement_snapshots (
    time TIMESTAMPTZ NOT NULL,
    profile_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    score BIGINT NOT NULL,
    tier SMALLINT NOT NULL,
    PRIMARY KEY (time, profile_id)
);

SELECT create_hypertable('engagement_snapshots', 'time');

CREATE INDEX idx_snapshots_profile ON engagement_snapshots(profile_id, time DESC);
CREATE INDEX idx_snapshots_workspace ON engagement_snapshots(workspace_id, time DESC);

-- Compression policies (compress data older than 7 days for wallet_events)
SELECT add_compression_policy('wallet_events', INTERVAL '7 days');
SELECT add_compression_policy('engagement_snapshots', INTERVAL '30 days');

-- Retention policy (auto-delete wallet_events older than 365 days)
SELECT add_retention_policy('wallet_events', INTERVAL '365 days');

-- ===================================
-- INDEXER CHECKPOINTS
-- ===================================

CREATE TABLE indexer_checkpoints (
    chain TEXT PRIMARY KEY DEFAULT 'sui',
    last_checkpoint BIGINT NOT NULL DEFAULT 0,
    last_processed_at TIMESTAMPTZ DEFAULT now()
);

-- Insert initial checkpoint
INSERT INTO indexer_checkpoints (chain, last_checkpoint) VALUES ('sui', 0);

-- ===================================
-- UTILITY FUNCTIONS
-- ===================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update_updated_at trigger to relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_segments_updated_at BEFORE UPDATE ON segments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vault_entries_updated_at BEFORE UPDATE ON vault_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================
-- COMMENTS (Documentation)
-- ===================================

COMMENT ON TABLE workspaces IS 'Multi-tenant workspaces (each workspace is independent)';
COMMENT ON TABLE profiles IS 'Customer profiles with engagement scoring and tier classification';
COMMENT ON TABLE wallet_bindings IS 'Multi-chain wallet addresses linked to a single profile';
COMMENT ON TABLE organizations IS 'Organizations/DAOs/Projects that profiles are associated with';
COMMENT ON TABLE deals IS 'Sales pipeline deals with stages and revenue tracking';
COMMENT ON TABLE segments IS 'Customer segments with dynamic rule-based membership';
COMMENT ON TABLE campaigns IS 'Marketing/engagement campaigns targeting segments';
COMMENT ON TABLE vault_entries IS 'Pointers to Seal-encrypted data stored on Walrus';
COMMENT ON TABLE wallet_events IS 'Time-series on-chain activity events (TimescaleDB hypertable)';
COMMENT ON TABLE engagement_snapshots IS 'Historical engagement score snapshots (TimescaleDB hypertable)';
COMMENT ON TABLE audit_logs IS 'Immutable audit trail of all system operations';

COMMENT ON COLUMN profiles.version IS 'Optimistic lock version — increment on every update, prevents concurrent modification conflicts';
COMMENT ON COLUMN profiles.is_archived IS 'Soft delete flag — archived profiles are hidden but never deleted';
COMMENT ON COLUMN profiles.search_vector IS 'Full-text search tsvector generated from display_name, suins_name, address, tags';
