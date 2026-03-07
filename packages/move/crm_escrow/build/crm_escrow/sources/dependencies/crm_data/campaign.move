module crm_data::campaign {
    use std::string::String;
    use sui::event;
    use crm_core::capabilities::{Self, GlobalConfig, WorkspaceAdminCap};
    use crm_core::workspace::{Self, Workspace};

    // Errors
    const EWorkspaceMismatch: u64 = 800;
    const EInvalidTransition: u64 = 801;

    // Status constants
    const STATUS_DRAFT: u8 = 0;
    const STATUS_ACTIVE: u8 = 1;
    const STATUS_PAUSED: u8 = 2;
    const STATUS_COMPLETED: u8 = 3;

    // AuditEvent constants
    const ACTION_CREATE: u8 = 0;
    const ACTION_UPDATE: u8 = 1;
    const OBJECT_CAMPAIGN: u8 = 4;

    // ===== Structs =====

    public struct Campaign has key, store {
        id: UID,
        workspace_id: ID,
        name: String,
        segment_id: ID,
        status: u8,
        start_time: Option<u64>,
        end_time: Option<u64>,
        reward_type: Option<String>,
        version: u64,
        created_at: u64,
        updated_at: u64,
    }

    // ===== Events =====

    public struct AuditEventV1 has copy, drop {
        version: u8,
        workspace_id: ID,
        actor: address,
        action: u8,
        object_type: u8,
        object_id: ID,
        timestamp: u64,
    }

    public struct CampaignStatusChanged has copy, drop {
        campaign_id: ID,
        workspace_id: ID,
        old_status: u8,
        new_status: u8,
    }

    // ===== Public functions =====

    public fun create(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        name: String,
        segment_id: ID,
        reward_type: Option<String>,
        ctx: &mut TxContext,
    ): Campaign {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));

        let campaign = Campaign {
            id: object::new(ctx),
            workspace_id: workspace::id(workspace),
            name,
            segment_id,
            status: STATUS_DRAFT,
            start_time: option::none(),
            end_time: option::none(),
            reward_type,
            version: 0,
            created_at: tx_context::epoch_timestamp_ms(ctx),
            updated_at: tx_context::epoch_timestamp_ms(ctx),
        };

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_CREATE,
            object_type: OBJECT_CAMPAIGN,
            object_id: object::id(&campaign),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });

        campaign
    }

    /// draft → active, paused → active
    public fun launch(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        campaign: &mut Campaign,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(campaign.workspace_id == workspace::id(workspace), EWorkspaceMismatch);
        assert!(
            campaign.status == STATUS_DRAFT || campaign.status == STATUS_PAUSED,
            EInvalidTransition,
        );

        let old_status = campaign.status;
        campaign.status = STATUS_ACTIVE;
        campaign.start_time = option::some(tx_context::epoch_timestamp_ms(ctx));
        campaign.version = campaign.version + 1;
        campaign.updated_at = tx_context::epoch_timestamp_ms(ctx);

        event::emit(CampaignStatusChanged {
            campaign_id: object::id(campaign),
            workspace_id: campaign.workspace_id,
            old_status,
            new_status: STATUS_ACTIVE,
        });

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_UPDATE,
            object_type: OBJECT_CAMPAIGN,
            object_id: object::id(campaign),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    /// active → paused
    public fun pause(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        campaign: &mut Campaign,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(campaign.workspace_id == workspace::id(workspace), EWorkspaceMismatch);
        assert!(campaign.status == STATUS_ACTIVE, EInvalidTransition);

        campaign.status = STATUS_PAUSED;
        campaign.version = campaign.version + 1;
        campaign.updated_at = tx_context::epoch_timestamp_ms(ctx);

        event::emit(CampaignStatusChanged {
            campaign_id: object::id(campaign),
            workspace_id: campaign.workspace_id,
            old_status: STATUS_ACTIVE,
            new_status: STATUS_PAUSED,
        });

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_UPDATE,
            object_type: OBJECT_CAMPAIGN,
            object_id: object::id(campaign),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    /// active → completed
    public fun complete(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        campaign: &mut Campaign,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(campaign.workspace_id == workspace::id(workspace), EWorkspaceMismatch);
        assert!(campaign.status == STATUS_ACTIVE, EInvalidTransition);

        campaign.status = STATUS_COMPLETED;
        campaign.end_time = option::some(tx_context::epoch_timestamp_ms(ctx));
        campaign.version = campaign.version + 1;
        campaign.updated_at = tx_context::epoch_timestamp_ms(ctx);

        event::emit(CampaignStatusChanged {
            campaign_id: object::id(campaign),
            workspace_id: campaign.workspace_id,
            old_status: STATUS_ACTIVE,
            new_status: STATUS_COMPLETED,
        });

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_UPDATE,
            object_type: OBJECT_CAMPAIGN,
            object_id: object::id(campaign),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    // Accessors
    public fun workspace_id(c: &Campaign): ID { c.workspace_id }
    public fun name(c: &Campaign): &String { &c.name }
    public fun status(c: &Campaign): u8 { c.status }
    public fun segment_id(c: &Campaign): ID { c.segment_id }
    public fun version(c: &Campaign): u64 { c.version }

    // Status constant accessors
    public fun status_draft(): u8 { STATUS_DRAFT }
    public fun status_active(): u8 { STATUS_ACTIVE }
    public fun status_paused(): u8 { STATUS_PAUSED }
    public fun status_completed(): u8 { STATUS_COMPLETED }
}
