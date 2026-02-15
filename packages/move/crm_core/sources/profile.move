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

    public fun update_tier_and_score(
        profile: &mut Profile,
        tier: u8,
        score: u64,
        ctx: &TxContext,
    ) {
        profile.tier = tier;
        profile.engagement_score = score;
        profile.version = profile.version + 1;
        profile.updated_at = tx_context::epoch_timestamp_ms(ctx);
    }

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

    public fun add_wallet(
        profile: &mut Profile,
        wallet_address: address,
        chain: String,
        ctx: &mut TxContext,
    ) {
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

    // Dynamic field extension with access control
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
    public fun workspace_id(p: &Profile): ID { p.workspace_id }
    public fun primary_address(p: &Profile): address { p.primary_address }
    public fun tier(p: &Profile): u8 { p.tier }
    public fun engagement_score(p: &Profile): u64 { p.engagement_score }
    public fun version(p: &Profile): u64 { p.version }
    public fun is_archived(p: &Profile): bool { p.is_archived }
}
