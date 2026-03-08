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
    const EInvalidStageTransition: u64 = 704;

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

    /// @notice Creates a new Deal linked to a profile within a workspace
    /// @param config - global config (pause check)
    /// @param workspace - target workspace
    /// @param cap - workspace admin capability
    /// @param profile_id - ID of the associated profile
    /// @param title - deal title
    /// @param amount_usd - deal value in micro-USD (1 USD = 1_000_000)
    /// @param stage - initial pipeline stage (0-5)
    /// @emits AuditEventV1
    /// @aborts EPaused - system is paused
    /// @aborts ECapMismatch - cap does not match workspace
    /// @aborts EInvalidStage - stage > STAGE_LOST
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

    /// @notice Updates deal fields with optimistic-lock and stage transition validation
    /// @param config - global config (pause check)
    /// @param workspace - workspace the deal belongs to
    /// @param cap - workspace admin capability
    /// @param deal - deal to update
    /// @param expected_version - optimistic concurrency version
    /// @param title - new title
    /// @param amount_usd - new amount in micro-USD
    /// @param stage - new pipeline stage
    /// @emits AuditEventV1
    /// @aborts EPaused - system is paused
    /// @aborts ECapMismatch - cap does not match workspace
    /// @aborts EWorkspaceMismatch - deal does not belong to workspace
    /// @aborts EVersionConflict - version mismatch
    /// @aborts EAlreadyArchived - deal is archived
    /// @aborts EInvalidStage - stage > STAGE_LOST
    /// @aborts EInvalidStageTransition - illegal stage transition
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
        assert!(is_valid_transition(deal.stage, stage), EInvalidStageTransition);

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

    /// @notice Soft-deletes a deal via optimistic-lock archive
    /// @param config - global config (pause check)
    /// @param workspace - workspace the deal belongs to
    /// @param cap - workspace admin capability
    /// @param deal - deal to archive
    /// @param expected_version - optimistic concurrency version
    /// @emits AuditEventV1
    /// @aborts EPaused - system is paused
    /// @aborts ECapMismatch - cap does not match workspace
    /// @aborts EWorkspaceMismatch - deal does not belong to workspace
    /// @aborts EVersionConflict - version mismatch
    /// @aborts EAlreadyArchived - deal is already archived
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

    // ===== Internal helpers =====

    fun is_valid_transition(from: u8, to: u8): bool {
        if (from == to) return true; // no-op is valid
        if (from == STAGE_WON || from == STAGE_LOST) return false; // terminal — no exit
        if (to == STAGE_LOST) return true; // can lose/abandon from any non-terminal stage
        to == from + 1 // strictly forward one step (LEAD→QUALIFIED→PROPOSAL→NEGOTIATION→WON)
    }

    // Accessors
    /// @notice Returns the workspace ID this deal belongs to
    public fun deal_workspace_id(d: &Deal): ID { d.workspace_id }
    /// @notice Returns the profile ID associated with this deal
    public fun deal_profile_id(d: &Deal): ID { d.profile_id }
    /// @notice Returns the deal title
    public fun deal_title(d: &Deal): &String { &d.title }
    /// @notice Returns the deal amount in micro-USD
    public fun deal_amount_usd(d: &Deal): u64 { d.amount_usd }
    /// @notice Returns the current pipeline stage
    public fun deal_stage(d: &Deal): u8 { d.stage }
    /// @notice Returns the current optimistic-lock version
    public fun deal_version(d: &Deal): u64 { d.version }
    /// @notice Returns whether the deal is archived
    public fun deal_is_archived(d: &Deal): bool { d.is_archived }

    // Stage constant accessors
    /// @notice Returns LEAD stage constant (0)
    public fun stage_lead(): u8 { STAGE_LEAD }
    /// @notice Returns QUALIFIED stage constant (1)
    public fun stage_qualified(): u8 { STAGE_QUALIFIED }
    /// @notice Returns PROPOSAL stage constant (2)
    public fun stage_proposal(): u8 { STAGE_PROPOSAL }
    /// @notice Returns NEGOTIATION stage constant (3)
    public fun stage_negotiation(): u8 { STAGE_NEGOTIATION }
    /// @notice Returns WON stage constant (4)
    public fun stage_won(): u8 { STAGE_WON }
    /// @notice Returns LOST stage constant (5)
    public fun stage_lost(): u8 { STAGE_LOST }
}
