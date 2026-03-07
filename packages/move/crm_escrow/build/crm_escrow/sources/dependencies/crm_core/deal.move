module crm_core::deal {
    use std::string::String;
    use sui::event;
    use crm_core::capabilities::{Self, GlobalConfig, WorkspaceAdminCap};
    use crm_core::workspace::{Self, Workspace};

    // Errors
    const EVersionConflict: u64 = 700;
    const EWorkspaceMismatch: u64 = 701;
    const EAlreadyArchived: u64 = 702;
    const EInvalidStage: u64 = 703;

    // AuditEvent constants
    const ACTION_CREATE: u8 = 0;
    const ACTION_UPDATE: u8 = 1;
    const ACTION_ARCHIVE: u8 = 5;

    const OBJECT_DEAL: u8 = 3;

    // Stage constants
    const STAGE_LEAD: u8 = 0;
    const STAGE_QUALIFIED: u8 = 1;
    const STAGE_PROPOSAL: u8 = 2;
    const STAGE_NEGOTIATION: u8 = 3;
    const STAGE_WON: u8 = 4;
    const STAGE_LOST: u8 = 5;

    // ===== Structs =====

    public struct Deal has key, store {
        id: UID,
        workspace_id: ID,
        profile_id: ID,
        title: String,
        amount_usd: u64,  // micro-USD (1 USD = 1_000_000)
        stage: u8,
        version: u64,
        is_archived: bool,
        archived_at: Option<u64>,
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

    // ===== Public functions =====

    public fun create_deal(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        profile_id: ID,
        title: String,
        amount_usd: u64,
        stage: u8,
        ctx: &mut TxContext,
    ): Deal {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(stage <= STAGE_LOST, EInvalidStage);

        let deal = Deal {
            id: object::new(ctx),
            workspace_id: workspace::id(workspace),
            profile_id,
            title,
            amount_usd,
            stage,
            version: 0,
            is_archived: false,
            archived_at: option::none(),
            created_at: tx_context::epoch_timestamp_ms(ctx),
            updated_at: tx_context::epoch_timestamp_ms(ctx),
        };

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_CREATE,
            object_type: OBJECT_DEAL,
            object_id: object::id(&deal),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });

        deal
    }

    public fun update_deal(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        deal: &mut Deal,
        expected_version: u64,
        title: String,
        amount_usd: u64,
        stage: u8,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(deal.workspace_id == workspace::id(workspace), EWorkspaceMismatch);
        assert!(deal.version == expected_version, EVersionConflict);
        assert!(!deal.is_archived, EAlreadyArchived);
        assert!(stage <= STAGE_LOST, EInvalidStage);

        deal.title = title;
        deal.amount_usd = amount_usd;
        deal.stage = stage;
        deal.version = deal.version + 1;
        deal.updated_at = tx_context::epoch_timestamp_ms(ctx);

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_UPDATE,
            object_type: OBJECT_DEAL,
            object_id: object::id(deal),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    public fun archive_deal(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        deal: &mut Deal,
        expected_version: u64,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(deal.workspace_id == workspace::id(workspace), EWorkspaceMismatch);
        assert!(deal.version == expected_version, EVersionConflict);
        assert!(!deal.is_archived, EAlreadyArchived);

        deal.is_archived = true;
        deal.archived_at = option::some(tx_context::epoch_timestamp_ms(ctx));
        deal.version = deal.version + 1;

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_ARCHIVE,
            object_type: OBJECT_DEAL,
            object_id: object::id(deal),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    // Accessors
    public fun deal_workspace_id(d: &Deal): ID { d.workspace_id }
    public fun deal_profile_id(d: &Deal): ID { d.profile_id }
    public fun deal_title(d: &Deal): &String { &d.title }
    public fun deal_amount_usd(d: &Deal): u64 { d.amount_usd }
    public fun deal_stage(d: &Deal): u8 { d.stage }
    public fun deal_version(d: &Deal): u64 { d.version }
    public fun deal_is_archived(d: &Deal): bool { d.is_archived }

    // Stage constant accessors
    public fun stage_lead(): u8 { STAGE_LEAD }
    public fun stage_qualified(): u8 { STAGE_QUALIFIED }
    public fun stage_proposal(): u8 { STAGE_PROPOSAL }
    public fun stage_negotiation(): u8 { STAGE_NEGOTIATION }
    public fun stage_won(): u8 { STAGE_WON }
    public fun stage_lost(): u8 { STAGE_LOST }
}
