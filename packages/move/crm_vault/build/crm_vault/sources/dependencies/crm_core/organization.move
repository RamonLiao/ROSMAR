module crm_core::organization {
    use std::string::String;
    use sui::dynamic_field;
    use sui::event;
    use crm_core::capabilities::{Self, GlobalConfig, WorkspaceAdminCap};
    use crm_core::workspace::{Self, Workspace};

    // Errors
    const EVersionConflict: u64 = 500;
    const EWorkspaceMismatch: u64 = 501;
    const EAlreadyArchived: u64 = 502;

    // AuditEvent constants
    const ACTION_CREATE: u8 = 0;
    const ACTION_UPDATE: u8 = 1;
    const ACTION_ARCHIVE: u8 = 5;

    const OBJECT_ORGANIZATION: u8 = 1;

    // ===== Structs =====

    public struct Organization has key, store {
        id: UID,
        workspace_id: ID,
        name: String,
        industry: Option<String>,
        website: Option<String>,
        tier: u8,
        tags: vector<String>,
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

    public fun create(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        name: String,
        industry: Option<String>,
        website: Option<String>,
        tags: vector<String>,
        ctx: &mut TxContext,
    ): Organization {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));

        let org = Organization {
            id: object::new(ctx),
            workspace_id: workspace::id(workspace),
            name,
            industry,
            website,
            tier: 0,
            tags,
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
            object_type: OBJECT_ORGANIZATION,
            object_id: object::id(&org),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });

        org
    }

    public fun update_name(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        org: &mut Organization,
        expected_version: u64,
        name: String,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(org.workspace_id == workspace::id(workspace), EWorkspaceMismatch);
        assert!(org.version == expected_version, EVersionConflict);

        org.name = name;
        org.version = org.version + 1;
        org.updated_at = tx_context::epoch_timestamp_ms(ctx);

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_UPDATE,
            object_type: OBJECT_ORGANIZATION,
            object_id: object::id(org),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    public fun archive(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        org: &mut Organization,
        expected_version: u64,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(org.workspace_id == workspace::id(workspace), EWorkspaceMismatch);
        assert!(org.version == expected_version, EVersionConflict);
        assert!(!org.is_archived, EAlreadyArchived);

        org.is_archived = true;
        org.archived_at = option::some(tx_context::epoch_timestamp_ms(ctx));
        org.version = org.version + 1;

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_ARCHIVE,
            object_type: OBJECT_ORGANIZATION,
            object_id: object::id(org),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    public fun set_metadata<V: store + drop>(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        org: &mut Organization,
        expected_version: u64,
        key: String,
        value: V,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(org.workspace_id == workspace::id(workspace), EWorkspaceMismatch);
        assert!(org.version == expected_version, EVersionConflict);

        if (dynamic_field::exists_(&org.id, key)) {
            *dynamic_field::borrow_mut(&mut org.id, key) = value;
        } else {
            dynamic_field::add(&mut org.id, key, value);
        };

        org.version = org.version + 1;
        org.updated_at = tx_context::epoch_timestamp_ms(ctx);

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_UPDATE,
            object_type: OBJECT_ORGANIZATION,
            object_id: object::id(org),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    // Accessors
    public fun workspace_id(o: &Organization): ID { o.workspace_id }
    public fun name(o: &Organization): &String { &o.name }
    public fun tier(o: &Organization): u8 { o.tier }
    public fun version(o: &Organization): u64 { o.version }
    public fun is_archived(o: &Organization): bool { o.is_archived }
}
