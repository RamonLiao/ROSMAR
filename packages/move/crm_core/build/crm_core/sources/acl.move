module crm_core::acl {
    // Permission bitmask constants
    const READ: u64     = 1;
    const WRITE: u64    = 2;
    const SHARE: u64    = 4;
    const DELETE: u64   = 8;
    const MANAGE: u64   = 16;
    const ADMIN: u64    = 31;

    // Role levels
    const ROLE_VIEWER: u8 = 0;
    const ROLE_MEMBER: u8 = 1;
    const ROLE_ADMIN: u8 = 2;
    const ROLE_OWNER: u8 = 3;

    // Errors
    const EInsufficientPermission: u64 = 200;

    public struct Role has store, copy, drop {
        level: u8,
        permissions: u64,
    }

    /// @notice Returns a viewer role with READ permission
    public fun viewer(): Role { Role { level: ROLE_VIEWER, permissions: READ } }
    /// @notice Returns a member role with READ | WRITE permissions
    public fun member(): Role { Role { level: ROLE_MEMBER, permissions: READ | WRITE } }
    /// @notice Returns an admin role with all permissions
    public fun admin(): Role { Role { level: ROLE_ADMIN, permissions: ADMIN } }
    /// @notice Returns an owner role with all permissions
    public fun owner(): Role { Role { level: ROLE_OWNER, permissions: ADMIN } }

    /// @notice Checks whether a role has the given permission bitmask
    /// @param role - the role to check
    /// @param permission - bitmask of required permissions
    public fun has_permission(role: &Role, permission: u64): bool {
        (role.permissions & permission) == permission
    }

    /// @notice Asserts the role has the given permission or aborts
    /// @param role - the role to check
    /// @param permission - bitmask of required permissions
    /// @aborts EInsufficientPermission - role lacks the required permission
    public fun assert_permission(role: &Role, permission: u64) {
        assert!(has_permission(role, permission), EInsufficientPermission);
    }

    /// @notice Returns the numeric level of a role
    public fun level(role: &Role): u8 { role.level }
    /// @notice Returns the permission bitmask of a role
    public fun permissions(role: &Role): u64 { role.permissions }

    /// @notice Creates a custom role with arbitrary level and permission bitmask
    /// @param level - role level (0-255)
    /// @param permissions - permission bitmask
    public fun custom_role(level: u8, permissions: u64): Role {
        Role { level, permissions }
    }

    // Permission constants accessors
    /// @notice Returns the READ permission bitmask (1)
    public fun perm_read(): u64 { READ }
    /// @notice Returns the WRITE permission bitmask (2)
    public fun perm_write(): u64 { WRITE }
    /// @notice Returns the SHARE permission bitmask (4)
    public fun perm_share(): u64 { SHARE }
    /// @notice Returns the DELETE permission bitmask (8)
    public fun perm_delete(): u64 { DELETE }
    /// @notice Returns the MANAGE permission bitmask (16)
    public fun perm_manage(): u64 { MANAGE }
}
