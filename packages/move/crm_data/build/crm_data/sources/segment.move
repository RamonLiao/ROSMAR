module crm_data::segment {
    use std::string::String;
    use sui::event;
    use crm_core::capabilities::{Self, GlobalConfig, WorkspaceAdminCap};
    use crm_core::workspace::{Self, Workspace};

    // Errors
    const EVersionConflict: u64 = 700;
    const EWorkspaceMismatch: u64 = 701;

    // AuditEvent constants
    const ACTION_CREATE: u8 = 0;
    const ACTION_UPDATE: u8 = 1;
    const OBJECT_SEGMENT: u8 = 3;

    // ===== Structs =====

    public struct Segment has key, store {
        id: UID,
        workspace_id: ID,
        name: String,
        rule_hash: vector<u8>,
        member_count: u64,
        is_dynamic: bool,
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

    // ===== Public functions =====

    public fun create(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        name: String,
        rule_hash: vector<u8>,
        is_dynamic: bool,
        ctx: &mut TxContext,
    ): Segment {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));

        let segment = Segment {
            id: object::new(ctx),
            workspace_id: workspace::id(workspace),
            name,
            rule_hash,
            member_count: 0,
            is_dynamic,
            version: 0,
            created_at: tx_context::epoch_timestamp_ms(ctx),
            updated_at: tx_context::epoch_timestamp_ms(ctx),
        };

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_CREATE,
            object_type: OBJECT_SEGMENT,
            object_id: object::id(&segment),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });

        segment
    }

    public fun update_rule_hash(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        segment: &mut Segment,
        expected_version: u64,
        rule_hash: vector<u8>,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(segment.workspace_id == workspace::id(workspace), EWorkspaceMismatch);
        assert!(segment.version == expected_version, EVersionConflict);

        segment.rule_hash = rule_hash;
        segment.version = segment.version + 1;
        segment.updated_at = tx_context::epoch_timestamp_ms(ctx);

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_UPDATE,
            object_type: OBJECT_SEGMENT,
            object_id: object::id(segment),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    public fun update_member_count(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        segment: &mut Segment,
        member_count: u64,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(segment.workspace_id == workspace::id(workspace), EWorkspaceMismatch);

        segment.member_count = member_count;
        segment.version = segment.version + 1;
        segment.updated_at = tx_context::epoch_timestamp_ms(ctx);
    }

    // Accessors
    public fun workspace_id(s: &Segment): ID { s.workspace_id }
    public fun name(s: &Segment): &String { &s.name }
    public fun rule_hash(s: &Segment): &vector<u8> { &s.rule_hash }
    public fun member_count(s: &Segment): u64 { s.member_count }
    public fun is_dynamic(s: &Segment): bool { s.is_dynamic }
    public fun version(s: &Segment): u64 { s.version }
}
