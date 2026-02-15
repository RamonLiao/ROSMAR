module crm_vault::policy {
    use std::string::String;
    use sui::event;
    use crm_core::capabilities::{Self, GlobalConfig, WorkspaceAdminCap};
    use crm_core::workspace::{Self, Workspace};

    // Errors
    const EVersionConflict: u64 = 1200;
    const EWorkspaceMismatch: u64 = 1201;

    // Access rule types
    const RULE_WORKSPACE_MEMBER: u8 = 0;
    const RULE_SPECIFIC_ADDRESS: u8 = 1;
    const RULE_ROLE_BASED: u8 = 2;

    // AuditEvent constants
    const ACTION_CREATE: u8 = 0;
    const ACTION_UPDATE: u8 = 1;
    const OBJECT_POLICY: u8 = 8;

    // ===== Structs =====

    /// Access policy for Seal integration — defines who can decrypt vault content
    public struct AccessPolicy has key, store {
        id: UID,
        workspace_id: ID,
        name: String,
        rule_type: u8,
        /// Addresses allowed to decrypt (for RULE_SPECIFIC_ADDRESS)
        allowed_addresses: vector<address>,
        /// Minimum role level required (for RULE_ROLE_BASED)
        min_role_level: u8,
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

    public fun create_workspace_policy(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        name: String,
        ctx: &mut TxContext,
    ): AccessPolicy {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));

        let policy = AccessPolicy {
            id: object::new(ctx),
            workspace_id: workspace::id(workspace),
            name,
            rule_type: RULE_WORKSPACE_MEMBER,
            allowed_addresses: vector::empty(),
            min_role_level: 0,
            version: 0,
            created_at: tx_context::epoch_timestamp_ms(ctx),
            updated_at: tx_context::epoch_timestamp_ms(ctx),
        };

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_CREATE,
            object_type: OBJECT_POLICY,
            object_id: object::id(&policy),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });

        policy
    }

    public fun create_address_policy(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        name: String,
        allowed_addresses: vector<address>,
        ctx: &mut TxContext,
    ): AccessPolicy {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));

        let policy = AccessPolicy {
            id: object::new(ctx),
            workspace_id: workspace::id(workspace),
            name,
            rule_type: RULE_SPECIFIC_ADDRESS,
            allowed_addresses,
            min_role_level: 0,
            version: 0,
            created_at: tx_context::epoch_timestamp_ms(ctx),
            updated_at: tx_context::epoch_timestamp_ms(ctx),
        };

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_CREATE,
            object_type: OBJECT_POLICY,
            object_id: object::id(&policy),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });

        policy
    }

    public fun create_role_policy(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        name: String,
        min_role_level: u8,
        ctx: &mut TxContext,
    ): AccessPolicy {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));

        let policy = AccessPolicy {
            id: object::new(ctx),
            workspace_id: workspace::id(workspace),
            name,
            rule_type: RULE_ROLE_BASED,
            allowed_addresses: vector::empty(),
            min_role_level,
            version: 0,
            created_at: tx_context::epoch_timestamp_ms(ctx),
            updated_at: tx_context::epoch_timestamp_ms(ctx),
        };

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_CREATE,
            object_type: OBJECT_POLICY,
            object_id: object::id(&policy),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });

        policy
    }

    public fun add_address(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        policy: &mut AccessPolicy,
        expected_version: u64,
        addr: address,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(policy.workspace_id == workspace::id(workspace), EWorkspaceMismatch);
        assert!(policy.version == expected_version, EVersionConflict);

        policy.allowed_addresses.push_back(addr);
        policy.version = policy.version + 1;
        policy.updated_at = tx_context::epoch_timestamp_ms(ctx);

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_UPDATE,
            object_type: OBJECT_POLICY,
            object_id: object::id(policy),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    // Accessors
    public fun workspace_id(p: &AccessPolicy): ID { p.workspace_id }
    public fun rule_type(p: &AccessPolicy): u8 { p.rule_type }
    public fun allowed_addresses(p: &AccessPolicy): &vector<address> { &p.allowed_addresses }
    public fun min_role_level(p: &AccessPolicy): u8 { p.min_role_level }
    public fun version(p: &AccessPolicy): u64 { p.version }

    // Rule type constant accessors
    public fun rule_workspace_member(): u8 { RULE_WORKSPACE_MEMBER }
    public fun rule_specific_address(): u8 { RULE_SPECIFIC_ADDRESS }
    public fun rule_role_based(): u8 { RULE_ROLE_BASED }
}
