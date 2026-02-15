module crm_core::relation {
    use std::string::String;
    use sui::event;
    use crm_core::capabilities::{Self, GlobalConfig, WorkspaceAdminCap};
    use crm_core::workspace::{Self, Workspace};

    // Errors
    const EVersionConflict: u64 = 600;
    const EWorkspaceMismatch: u64 = 601;
    const EAlreadyArchived: u64 = 602;

    // AuditEvent constants
    const ACTION_CREATE: u8 = 0;
    const ACTION_UPDATE: u8 = 1;
    const ACTION_ARCHIVE: u8 = 5;

    const OBJECT_RELATION: u8 = 2;

    // Relation types
    const RELATION_MEMBER_OF: u8 = 0;
    const RELATION_PARTNER: u8 = 1;
    const RELATION_INVESTOR: u8 = 2;
    const RELATION_ADVISOR: u8 = 3;

    // ===== Structs =====

    public struct Relation has key, store {
        id: UID,
        workspace_id: ID,
        profile_id: ID,
        organization_id: ID,
        relation_type: u8,
        title: Option<String>,
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
        profile_id: ID,
        organization_id: ID,
        relation_type: u8,
        title: Option<String>,
        ctx: &mut TxContext,
    ): Relation {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));

        let relation = Relation {
            id: object::new(ctx),
            workspace_id: workspace::id(workspace),
            profile_id,
            organization_id,
            relation_type,
            title,
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
            object_type: OBJECT_RELATION,
            object_id: object::id(&relation),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });

        relation
    }

    public fun update_type(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        relation: &mut Relation,
        expected_version: u64,
        relation_type: u8,
        title: Option<String>,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(relation.workspace_id == workspace::id(workspace), EWorkspaceMismatch);
        assert!(relation.version == expected_version, EVersionConflict);

        relation.relation_type = relation_type;
        relation.title = title;
        relation.version = relation.version + 1;
        relation.updated_at = tx_context::epoch_timestamp_ms(ctx);

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_UPDATE,
            object_type: OBJECT_RELATION,
            object_id: object::id(relation),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    public fun archive(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        relation: &mut Relation,
        expected_version: u64,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(relation.workspace_id == workspace::id(workspace), EWorkspaceMismatch);
        assert!(relation.version == expected_version, EVersionConflict);
        assert!(!relation.is_archived, EAlreadyArchived);

        relation.is_archived = true;
        relation.archived_at = option::some(tx_context::epoch_timestamp_ms(ctx));
        relation.version = relation.version + 1;

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_ARCHIVE,
            object_type: OBJECT_RELATION,
            object_id: object::id(relation),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    // Accessors
    public fun workspace_id(r: &Relation): ID { r.workspace_id }
    public fun profile_id(r: &Relation): ID { r.profile_id }
    public fun organization_id(r: &Relation): ID { r.organization_id }
    public fun relation_type(r: &Relation): u8 { r.relation_type }
    public fun version(r: &Relation): u64 { r.version }
    public fun is_archived(r: &Relation): bool { r.is_archived }

    // Relation type constants accessors
    public fun type_member_of(): u8 { RELATION_MEMBER_OF }
    public fun type_partner(): u8 { RELATION_PARTNER }
    public fun type_investor(): u8 { RELATION_INVESTOR }
    public fun type_advisor(): u8 { RELATION_ADVISOR }
}
