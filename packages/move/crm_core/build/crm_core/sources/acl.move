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

    public fun viewer(): Role { Role { level: ROLE_VIEWER, permissions: READ } }
    public fun member(): Role { Role { level: ROLE_MEMBER, permissions: READ | WRITE } }
    public fun admin(): Role { Role { level: ROLE_ADMIN, permissions: ADMIN } }
    public fun owner(): Role { Role { level: ROLE_OWNER, permissions: ADMIN } }

    public fun has_permission(role: &Role, permission: u64): bool {
        (role.permissions & permission) == permission
    }

    public fun assert_permission(role: &Role, permission: u64) {
        assert!(has_permission(role, permission), EInsufficientPermission);
    }

    public fun level(role: &Role): u8 { role.level }
    public fun permissions(role: &Role): u64 { role.permissions }

    public fun custom_role(level: u8, permissions: u64): Role {
        Role { level, permissions }
    }

    // Permission constants accessors
    public fun perm_read(): u64 { READ }
    public fun perm_write(): u64 { WRITE }
    public fun perm_share(): u64 { SHARE }
    public fun perm_delete(): u64 { DELETE }
    public fun perm_manage(): u64 { MANAGE }
}
