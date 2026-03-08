module crm_core::workspace {
    use std::string::String;
    use sui::dynamic_object_field;
    use sui::event;
    use crm_core::acl::{Self, Role};
    use crm_core::capabilities::{Self, GlobalConfig, WorkspaceAdminCap};

    // Errors
    const ENotOwner: u64 = 300;
    const EMemberExists: u64 = 301;
    const EMemberNotFound: u64 = 302;
    const EWorkspaceMismatch: u64 = 303;

    // ===== Structs =====

    public struct Workspace has key {
        id: UID,
        name: String,
        owner: address,
        member_count: u64,
        created_at: u64,
    }

    /// Stored as dynamic_object_field — independently queryable
    public struct MemberRecord has key, store {
        id: UID,
        workspace_id: ID,
        address: address,
        role: Role,
        joined_at: u64,
    }

    // ===== Events =====

    public struct WorkspaceCreated has copy, drop {
        workspace_id: ID,
        owner: address,
        name: String,
    }

    public struct MemberAdded has copy, drop {
        workspace_id: ID,
        member: address,
        role_level: u8,
    }

    public struct MemberRemoved has copy, drop {
        workspace_id: ID,
        member: address,
    }

    // ===== Public functions =====

    /// @notice Creates a new workspace with the caller as owner and first member
    /// @param config - global config (pause check)
    /// @param name - workspace display name
    /// @emits WorkspaceCreated
    /// @aborts EPaused - system is paused
    public fun create(
        config: &GlobalConfig,
        name: String,
        ctx: &mut TxContext,
    ): (Workspace, WorkspaceAdminCap) {
        capabilities::assert_not_paused(config);

        let mut workspace = Workspace {
            id: object::new(ctx),
            name,
            owner: ctx.sender(),
            member_count: 1,
            created_at: tx_context::epoch_timestamp_ms(ctx),
        };

        let workspace_id = object::id(&workspace);

        // Create admin cap for owner
        let admin_cap = capabilities::create_admin_cap(workspace_id, ctx);

        // Add owner as member (dynamic_object_field)
        let member = MemberRecord {
            id: object::new(ctx),
            workspace_id,
            address: ctx.sender(),
            role: acl::owner(),
            joined_at: tx_context::epoch_timestamp_ms(ctx),
        };
        dynamic_object_field::add(&mut workspace.id, ctx.sender(), member);

        event::emit(WorkspaceCreated {
            workspace_id,
            owner: ctx.sender(),
            name: workspace.name,
        });

        (workspace, admin_cap)
    }

    /// @notice Adds a new member to the workspace with the given role
    /// @param config - global config (pause check)
    /// @param workspace - workspace to add member to
    /// @param cap - workspace admin capability
    /// @param member_address - address of the new member
    /// @param role - ACL role to assign
    /// @emits MemberAdded
    /// @aborts EPaused - system is paused
    /// @aborts ECapMismatch - cap does not match workspace
    /// @aborts EMemberExists - member already exists in workspace
    public fun add_member(
        config: &GlobalConfig,
        workspace: &mut Workspace,
        cap: &WorkspaceAdminCap,
        member_address: address,
        role: Role,
        ctx: &mut TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, object::id(workspace));
        assert!(
            !dynamic_object_field::exists_<address>(&workspace.id, member_address),
            EMemberExists
        );

        let member = MemberRecord {
            id: object::new(ctx),
            workspace_id: object::id(workspace),
            address: member_address,
            role,
            joined_at: tx_context::epoch_timestamp_ms(ctx),
        };
        dynamic_object_field::add(&mut workspace.id, member_address, member);
        workspace.member_count = workspace.member_count + 1;

        event::emit(MemberAdded {
            workspace_id: object::id(workspace),
            member: member_address,
            role_level: acl::level(&role),
        });
    }

    /// @notice Removes a member from the workspace and destroys their MemberRecord
    /// @param config - global config (pause check)
    /// @param workspace - workspace to remove member from
    /// @param cap - workspace admin capability
    /// @param member_address - address of the member to remove
    /// @emits MemberRemoved
    /// @aborts EPaused - system is paused
    /// @aborts ECapMismatch - cap does not match workspace
    /// @aborts ENotOwner - cannot remove the workspace owner
    public fun remove_member(
        config: &GlobalConfig,
        workspace: &mut Workspace,
        cap: &WorkspaceAdminCap,
        member_address: address,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, object::id(workspace));
        assert!(member_address != workspace.owner, ENotOwner);

        let member: MemberRecord = dynamic_object_field::remove(
            &mut workspace.id,
            member_address,
        );
        workspace.member_count = workspace.member_count - 1;

        event::emit(MemberRemoved {
            workspace_id: object::id(workspace),
            member: member_address,
        });

        // Destroy removed member record
        let MemberRecord { id, .. } = member;
        object::delete(id);
    }

    /// @notice Returns a reference to the Role of a workspace member
    /// @param workspace - workspace to query
    /// @param member_address - address of the member
    public fun get_member_role(
        workspace: &Workspace,
        member_address: address,
    ): &Role {
        let member: &MemberRecord = dynamic_object_field::borrow(
            &workspace.id,
            member_address,
        );
        &member.role
    }

    /// @notice Checks whether an address is a member of the workspace
    public fun is_member(workspace: &Workspace, addr: address): bool {
        dynamic_object_field::exists_<address>(&workspace.id, addr)
    }

    // Accessors
    /// @notice Returns the workspace object ID
    public fun id(w: &Workspace): ID { object::id(w) }
    /// @notice Returns the workspace owner address
    public fun owner(w: &Workspace): address { w.owner }
    /// @notice Returns the workspace name
    public fun name(w: &Workspace): &String { &w.name }
    /// @notice Returns the current member count
    public fun member_count(w: &Workspace): u64 { w.member_count }
}
