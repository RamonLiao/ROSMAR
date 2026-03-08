module crm_data::deal {
    use std::string::String;
    use sui::event;
    use crm_core::capabilities::{Self, GlobalConfig, WorkspaceAdminCap};
    use crm_core::workspace::{Self, Workspace};

    // Errors
    const EVersionConflict: u64 = 900;
    const EWorkspaceMismatch: u64 = 901;
    const EInvalidTransition: u64 = 902;
    const EAlreadyArchived: u64 = 903;

    // Stage constants
    const STAGE_NEW: u8 = 0;
    const STAGE_QUALIFIED: u8 = 1;
    const STAGE_PROPOSAL: u8 = 2;
    const STAGE_WON: u8 = 3;
    const STAGE_LOST: u8 = 4;

    // AuditEvent constants
    const ACTION_CREATE: u8 = 0;
    const ACTION_UPDATE: u8 = 1;
    const ACTION_ARCHIVE: u8 = 5;
    const OBJECT_DEAL: u8 = 5;

    // ===== Structs =====

    public struct Deal has key, store {
        id: UID,
        workspace_id: ID,
        profile_id: ID,
        organization_id: Option<ID>,
        name: String,
        stage: u8,
        value: u64,
        currency: String,
        expected_close_date: Option<u64>,
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

    public struct DealStageChanged has copy, drop {
        deal_id: ID,
        workspace_id: ID,
        old_stage: u8,
        new_stage: u8,
    }

    // ===== Public functions =====

    /// @notice Create a new deal in NEW stage
    /// @param config - Global configuration (pause guard)
    /// @param workspace - Target workspace
    /// @param cap - Workspace admin capability
    /// @param profile_id - Associated contact profile
    /// @param organization_id - Optional associated organization
    /// @param name - Deal name
    /// @param value - Deal monetary value
    /// @param currency - Currency code
    /// @param expected_close_date - Optional expected close date (epoch ms)
    /// @emits AuditEventV1
    /// @aborts EGlobalPaused - if system is paused
    /// @aborts ECapMismatch - if cap does not match workspace
    public fun create(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        profile_id: ID,
        organization_id: Option<ID>,
        name: String,
        value: u64,
        currency: String,
        expected_close_date: Option<u64>,
        ctx: &mut TxContext,
    ): Deal {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));

        let deal = Deal {
            id: object::new(ctx),
            workspace_id: workspace::id(workspace),
            profile_id,
            organization_id,
            name,
            stage: STAGE_NEW,
            value,
            currency,
            expected_close_date,
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

    /// @notice Advance deal stage (new->qualified->proposal->won/lost)
    /// @param config - Global configuration (pause guard)
    /// @param workspace - Target workspace
    /// @param cap - Workspace admin capability
    /// @param deal - Deal to advance
    /// @param expected_version - Optimistic concurrency version
    /// @param new_stage - Target stage constant
    /// @emits DealStageChanged
    /// @emits AuditEventV1
    /// @aborts EWorkspaceMismatch - if deal does not belong to workspace
    /// @aborts EVersionConflict - if expected_version != deal.version
    /// @aborts EAlreadyArchived - if deal is archived
    /// @aborts EInvalidTransition - if stage transition is invalid
    public fun advance_stage(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        deal: &mut Deal,
        expected_version: u64,
        new_stage: u8,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(deal.workspace_id == workspace::id(workspace), EWorkspaceMismatch);
        assert!(deal.version == expected_version, EVersionConflict);
        assert!(!deal.is_archived, EAlreadyArchived);
        assert!(is_valid_transition(deal.stage, new_stage), EInvalidTransition);

        let old_stage = deal.stage;
        deal.stage = new_stage;
        deal.version = deal.version + 1;
        deal.updated_at = tx_context::epoch_timestamp_ms(ctx);

        event::emit(DealStageChanged {
            deal_id: object::id(deal),
            workspace_id: deal.workspace_id,
            old_stage,
            new_stage,
        });

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

    /// @notice Soft-archive a deal (sets is_archived flag)
    /// @param config - Global configuration (pause guard)
    /// @param workspace - Target workspace
    /// @param cap - Workspace admin capability
    /// @param deal - Deal to archive
    /// @param expected_version - Optimistic concurrency version
    /// @emits AuditEventV1
    /// @aborts EWorkspaceMismatch - if deal does not belong to workspace
    /// @aborts EVersionConflict - if expected_version != deal.version
    /// @aborts EAlreadyArchived - if deal is already archived
    public fun archive(
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

    // ===== Internal helpers =====

    fun is_valid_transition(from: u8, to: u8): bool {
        if (from == STAGE_NEW && to == STAGE_QUALIFIED) return true;
        if (from == STAGE_QUALIFIED && to == STAGE_PROPOSAL) return true;
        if (from == STAGE_PROPOSAL && (to == STAGE_WON || to == STAGE_LOST)) return true;
        // Allow skipping to won/lost from any non-terminal stage
        if (from != STAGE_WON && from != STAGE_LOST && (to == STAGE_WON || to == STAGE_LOST)) return true;
        false
    }

    // Accessors

    /// @notice Return the workspace ID
    public fun workspace_id(d: &Deal): ID { d.workspace_id }
    /// @notice Return the associated profile ID
    public fun profile_id(d: &Deal): ID { d.profile_id }
    /// @notice Return the deal name
    public fun name(d: &Deal): &String { &d.name }
    /// @notice Return the current stage
    public fun stage(d: &Deal): u8 { d.stage }
    /// @notice Return the deal monetary value
    public fun value(d: &Deal): u64 { d.value }
    /// @notice Return the current optimistic-lock version
    public fun version(d: &Deal): u64 { d.version }
    /// @notice Return whether the deal is archived
    public fun is_archived(d: &Deal): bool { d.is_archived }

    // Stage constant accessors

    /// @notice Return STAGE_NEW constant (0)
    public fun stage_new(): u8 { STAGE_NEW }
    /// @notice Return STAGE_QUALIFIED constant (1)
    public fun stage_qualified(): u8 { STAGE_QUALIFIED }
    /// @notice Return STAGE_PROPOSAL constant (2)
    public fun stage_proposal(): u8 { STAGE_PROPOSAL }
    /// @notice Return STAGE_WON constant (3)
    public fun stage_won(): u8 { STAGE_WON }
    /// @notice Return STAGE_LOST constant (4)
    public fun stage_lost(): u8 { STAGE_LOST }
}
