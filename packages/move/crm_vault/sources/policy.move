module crm_vault::policy {
    use std::string::String;
    use sui::event;
    use crm_core::capabilities::{Self, GlobalConfig, WorkspaceAdminCap};
    use crm_core::workspace::{Self, Workspace};

    // Errors
    const EVersionConflict: u64 = 1200;
    const EWorkspaceMismatch: u64 = 1201;
    const ESealNoAccess: u64 = 1202;
    const ESealInvalidIdentity: u64 = 1203;

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

    /// @notice Create a workspace-member access policy (any workspace member can decrypt)
    /// @param config - Global configuration (pause guard)
    /// @param workspace - Target workspace
    /// @param cap - Workspace admin capability
    /// @param name - Display name of the policy
    /// @emits AuditEventV1
    /// @aborts EGlobalPaused - if system is paused
    /// @aborts ECapMismatch - if cap does not match workspace
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

    /// @notice Create an address-list access policy (only listed addresses can decrypt)
    /// @param config - Global configuration (pause guard)
    /// @param workspace - Target workspace
    /// @param cap - Workspace admin capability
    /// @param name - Display name of the policy
    /// @param allowed_addresses - Addresses permitted to decrypt
    /// @emits AuditEventV1
    /// @aborts EGlobalPaused - if system is paused
    /// @aborts ECapMismatch - if cap does not match workspace
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

    /// @notice Create a role-based access policy (minimum role level required)
    /// @param config - Global configuration (pause guard)
    /// @param workspace - Target workspace
    /// @param cap - Workspace admin capability
    /// @param name - Display name of the policy
    /// @param min_role_level - Minimum role level to decrypt
    /// @emits AuditEventV1
    /// @aborts EGlobalPaused - if system is paused
    /// @aborts ECapMismatch - if cap does not match workspace
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

    /// @notice Append an address to an existing address-list policy
    /// @param config - Global configuration (pause guard)
    /// @param workspace - Target workspace
    /// @param cap - Workspace admin capability
    /// @param policy - Access policy to update
    /// @param expected_version - Optimistic concurrency version
    /// @param addr - Address to add
    /// @emits AuditEventV1
    /// @aborts EWorkspaceMismatch - if policy does not belong to workspace
    /// @aborts EVersionConflict - if expected_version != policy.version
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

    // ===== Seal Key-Server Verification =====

    /// @notice Verify that the caller is allowed to decrypt content under this policy.
    ///         Called by Seal key servers via dry-run transaction.
    /// @param id - Raw identity bytes (policy object address) used during encryption
    /// @param policy - Access policy to check against
    /// @param workspace - Workspace the policy belongs to (on-chain membership source)
    /// @aborts EWorkspaceMismatch - if policy does not belong to the given workspace
    /// @aborts ESealNoAccess - if sender is not a workspace member (RULE_WORKSPACE_MEMBER)
    /// @aborts ESealNoAccess - if sender is not in allowed_addresses (RULE_SPECIFIC_ADDRESS)
    /// @aborts ESealNoAccess - if sender lacks min_role_level (RULE_ROLE_BASED)
    /// @aborts ESealNoAccess - if rule_type is unknown
    /// @aborts ESealInvalidIdentity - if id does not match policy object address
    entry fun seal_approve(
        id: vector<u8>,
        policy: &AccessPolicy,
        workspace: &Workspace,
        ctx: &TxContext,
    ) {
        // Verify policy belongs to this workspace (prevents cross-workspace attack)
        assert!(policy.workspace_id == workspace::id(workspace), EWorkspaceMismatch);

        let sender = ctx.sender();
        let rule = policy.rule_type;

        if (rule == RULE_WORKSPACE_MEMBER) {
            assert!(workspace::is_member(workspace, sender), ESealNoAccess);
        } else if (rule == RULE_SPECIFIC_ADDRESS) {
            assert!(policy.allowed_addresses.contains(&sender), ESealNoAccess);
        } else if (rule == RULE_ROLE_BASED) {
            assert!(workspace::is_member(workspace, sender), ESealNoAccess);
            let role = workspace::get_member_role(workspace, sender);
            assert!(crm_core::acl::level(role) >= policy.min_role_level, ESealNoAccess);
        } else {
            abort ESealNoAccess
        };

        // Ensure the id matches this policy's object address (prevents cross-policy replay).
        let policy_addr = object::id_address(policy);
        let id_addr = sui::address::from_bytes(id);
        assert!(policy_addr == id_addr, ESealInvalidIdentity);
    }

    // Accessors

    /// @notice Return the workspace ID this policy belongs to
    public fun workspace_id(p: &AccessPolicy): ID { p.workspace_id }
    /// @notice Return the rule type (0=workspace_member, 1=specific_address, 2=role_based)
    public fun rule_type(p: &AccessPolicy): u8 { p.rule_type }
    /// @notice Return the list of allowed addresses
    public fun allowed_addresses(p: &AccessPolicy): &vector<address> { &p.allowed_addresses }
    /// @notice Return the minimum role level required
    public fun min_role_level(p: &AccessPolicy): u8 { p.min_role_level }
    /// @notice Return the current optimistic-lock version
    public fun version(p: &AccessPolicy): u64 { p.version }

    // Rule type constant accessors

    /// @notice Return RULE_WORKSPACE_MEMBER constant (0)
    public fun rule_workspace_member(): u8 { RULE_WORKSPACE_MEMBER }
    /// @notice Return RULE_SPECIFIC_ADDRESS constant (1)
    public fun rule_specific_address(): u8 { RULE_SPECIFIC_ADDRESS }
    /// @notice Return RULE_ROLE_BASED constant (2)
    public fun rule_role_based(): u8 { RULE_ROLE_BASED }
}
