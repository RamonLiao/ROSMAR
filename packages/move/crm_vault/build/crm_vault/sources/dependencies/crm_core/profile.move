module crm_core::profile {
    use std::string::String;
    use sui::dynamic_object_field;
    use sui::dynamic_field;
    use sui::event;
    use crm_core::capabilities::{Self, GlobalConfig, WorkspaceAdminCap};
    use crm_core::workspace::{Self, Workspace};

    // Errors
    const EVersionConflict: u64 = 400;
    const EWorkspaceMismatch: u64 = 401;
    const EAlreadyArchived: u64 = 402;

    // AuditEvent constants
    const ACTION_CREATE: u8 = 0;
    const ACTION_UPDATE: u8 = 1;
    const ACTION_ARCHIVE: u8 = 5;

    const OBJECT_PROFILE: u8 = 0;

    // ===== Structs =====

    public struct Profile has key, store {
        id: UID,
        workspace_id: ID,
        primary_address: address,
        suins_name: Option<String>,
        tier: u8,
        engagement_score: u64,
        tags: vector<String>,
        walrus_blob_id: Option<ID>,
        seal_policy_id: Option<ID>,
        version: u64,
        is_archived: bool,
        archived_at: Option<u64>,
        created_at: u64,
        updated_at: u64,
    }

    /// Stored as dynamic_object_field on Profile
    public struct WalletBinding has key, store {
        id: UID,
        profile_id: ID,
        address: address,
        chain: String,
        added_at: u64,
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

    /// @notice Creates a new Profile within a workspace
    /// @param config - global config (pause check)
    /// @param workspace - target workspace
    /// @param cap - workspace admin capability
    /// @param primary_address - wallet address of the profile owner
    /// @param suins_name - optional SuiNS name
    /// @param tags - classification tags
    /// @emits AuditEventV1
    /// @aborts EPaused - system is paused
    /// @aborts ECapMismatch - cap does not match workspace
    public fun create(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        primary_address: address,
        suins_name: Option<String>,
        tags: vector<String>,
        ctx: &mut TxContext,
    ): Profile {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));

        let profile = Profile {
            id: object::new(ctx),
            workspace_id: workspace::id(workspace),
            primary_address,
            suins_name,
            tier: 0,
            engagement_score: 0,
            tags,
            walrus_blob_id: option::none(),
            seal_policy_id: option::none(),
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
            object_type: OBJECT_PROFILE,
            object_id: object::id(&profile),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });

        profile
    }

    /// @notice Updates the tier and engagement score of a profile
    /// @param config - global config (pause check)
    /// @param workspace - workspace the profile belongs to
    /// @param cap - workspace admin capability
    /// @param profile - profile to update
    /// @param tier - new tier value
    /// @param score - new engagement score
    /// @aborts EWorkspaceMismatch - if profile workspace doesn't match
    public fun update_tier_and_score(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        profile: &mut Profile,
        tier: u8,
        score: u64,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(profile.workspace_id == workspace::id(workspace), EWorkspaceMismatch);
        profile.tier = tier;
        profile.engagement_score = score;
        profile.version = profile.version + 1;
        profile.updated_at = tx_context::epoch_timestamp_ms(ctx);
    }

    /// @notice Soft-deletes a profile via optimistic-lock archive
    /// @param config - global config (pause check)
    /// @param workspace - workspace the profile belongs to
    /// @param cap - workspace admin capability
    /// @param profile - profile to archive
    /// @param expected_version - optimistic concurrency version
    /// @emits AuditEventV1
    /// @aborts EPaused - system is paused
    /// @aborts ECapMismatch - cap does not match workspace
    /// @aborts EWorkspaceMismatch - profile does not belong to workspace
    /// @aborts EVersionConflict - version mismatch (concurrent edit)
    /// @aborts EAlreadyArchived - profile is already archived
    public fun archive(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        profile: &mut Profile,
        expected_version: u64,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(profile.workspace_id == workspace::id(workspace), EWorkspaceMismatch);
        assert!(profile.version == expected_version, EVersionConflict);
        assert!(!profile.is_archived, EAlreadyArchived);

        profile.is_archived = true;
        profile.archived_at = option::some(tx_context::epoch_timestamp_ms(ctx));
        profile.version = profile.version + 1;

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_ARCHIVE,
            object_type: OBJECT_PROFILE,
            object_id: object::id(profile),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    /// @notice Adds a wallet binding as a dynamic object field on the profile
    /// @param config - global config (pause check)
    /// @param workspace - workspace the profile belongs to
    /// @param cap - workspace admin capability
    /// @param profile - profile to add wallet to
    /// @param wallet_address - address of the wallet being bound
    /// @param chain - chain identifier string
    /// @aborts EPaused - system is paused
    /// @aborts ECapMismatch - cap does not match workspace
    /// @aborts EWorkspaceMismatch - profile does not belong to workspace
    public fun add_wallet(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        profile: &mut Profile,
        wallet_address: address,
        chain: String,
        ctx: &mut TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(profile.workspace_id == workspace::id(workspace), EWorkspaceMismatch);

        let binding = WalletBinding {
            id: object::new(ctx),
            profile_id: object::id(profile),
            address: wallet_address,
            chain,
            added_at: tx_context::epoch_timestamp_ms(ctx),
        };
        dynamic_object_field::add(&mut profile.id, wallet_address, binding);
        profile.version = profile.version + 1;
    }

    /// @notice Sets or updates a dynamic field metadata entry on the profile
    /// @param config - global config (pause check)
    /// @param workspace - workspace the profile belongs to
    /// @param cap - workspace admin capability
    /// @param profile - profile to set metadata on
    /// @param expected_version - optimistic concurrency version
    /// @param key - metadata key
    /// @param value - metadata value
    /// @emits AuditEventV1
    /// @aborts EPaused - system is paused
    /// @aborts ECapMismatch - cap does not match workspace
    /// @aborts EWorkspaceMismatch - profile does not belong to workspace
    /// @aborts EVersionConflict - version mismatch (concurrent edit)
    public fun set_metadata<V: store + drop>(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        profile: &mut Profile,
        expected_version: u64,
        key: String,
        value: V,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(profile.workspace_id == workspace::id(workspace), EWorkspaceMismatch);
        assert!(profile.version == expected_version, EVersionConflict);

        if (dynamic_field::exists_(&profile.id, key)) {
            *dynamic_field::borrow_mut(&mut profile.id, key) = value;
        } else {
            dynamic_field::add(&mut profile.id, key, value);
        };

        profile.version = profile.version + 1;
        profile.updated_at = tx_context::epoch_timestamp_ms(ctx);

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_UPDATE,
            object_type: OBJECT_PROFILE,
            object_id: object::id(profile),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    // Accessors
    /// @notice Returns the workspace ID this profile belongs to
    public fun workspace_id(p: &Profile): ID { p.workspace_id }
    /// @notice Returns the primary wallet address of the profile
    public fun primary_address(p: &Profile): address { p.primary_address }
    /// @notice Returns the profile tier
    public fun tier(p: &Profile): u8 { p.tier }
    /// @notice Returns the engagement score
    public fun engagement_score(p: &Profile): u64 { p.engagement_score }
    /// @notice Returns the current optimistic-lock version
    public fun version(p: &Profile): u64 { p.version }
    /// @notice Returns whether the profile is archived
    public fun is_archived(p: &Profile): bool { p.is_archived }
}
