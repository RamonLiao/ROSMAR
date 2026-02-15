module crm_vault::vault {
    use std::string::String;
    use sui::event;
    use crm_core::capabilities::{Self, GlobalConfig, WorkspaceAdminCap};
    use crm_core::workspace::{Self, Workspace};

    // Errors
    const EVersionConflict: u64 = 1100;
    const EWorkspaceMismatch: u64 = 1101;
    const EAlreadyArchived: u64 = 1102;

    // Vault type constants
    const VAULT_NOTE: u8 = 0;
    const VAULT_FILE: u8 = 1;

    // AuditEvent constants
    const ACTION_CREATE: u8 = 0;
    const ACTION_UPDATE: u8 = 1;
    const ACTION_ARCHIVE: u8 = 5;
    const OBJECT_VAULT: u8 = 7;

    // ===== Structs =====

    public struct Vault has key, store {
        id: UID,
        workspace_id: ID,
        owner_profile_id: ID,
        vault_type: u8,
        walrus_blob_id: Option<ID>,
        seal_policy_id: Option<ID>,
        name: String,
        mime_type: Option<String>,
        size_bytes: u64,
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
        owner_profile_id: ID,
        vault_type: u8,
        name: String,
        mime_type: Option<String>,
        size_bytes: u64,
        ctx: &mut TxContext,
    ): Vault {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));

        let vault = Vault {
            id: object::new(ctx),
            workspace_id: workspace::id(workspace),
            owner_profile_id,
            vault_type,
            walrus_blob_id: option::none(),
            seal_policy_id: option::none(),
            name,
            mime_type,
            size_bytes,
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
            object_type: OBJECT_VAULT,
            object_id: object::id(&vault),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });

        vault
    }

    public fun set_blob(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        vault: &mut Vault,
        expected_version: u64,
        walrus_blob_id: ID,
        seal_policy_id: ID,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(vault.workspace_id == workspace::id(workspace), EWorkspaceMismatch);
        assert!(vault.version == expected_version, EVersionConflict);
        assert!(!vault.is_archived, EAlreadyArchived);

        vault.walrus_blob_id = option::some(walrus_blob_id);
        vault.seal_policy_id = option::some(seal_policy_id);
        vault.version = vault.version + 1;
        vault.updated_at = tx_context::epoch_timestamp_ms(ctx);

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_UPDATE,
            object_type: OBJECT_VAULT,
            object_id: object::id(vault),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    public fun archive(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        vault: &mut Vault,
        expected_version: u64,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(vault.workspace_id == workspace::id(workspace), EWorkspaceMismatch);
        assert!(vault.version == expected_version, EVersionConflict);
        assert!(!vault.is_archived, EAlreadyArchived);

        vault.is_archived = true;
        vault.archived_at = option::some(tx_context::epoch_timestamp_ms(ctx));
        vault.version = vault.version + 1;

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_ARCHIVE,
            object_type: OBJECT_VAULT,
            object_id: object::id(vault),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    // Accessors
    public fun workspace_id(v: &Vault): ID { v.workspace_id }
    public fun owner_profile_id(v: &Vault): ID { v.owner_profile_id }
    public fun vault_type(v: &Vault): u8 { v.vault_type }
    public fun version(v: &Vault): u64 { v.version }
    public fun is_archived(v: &Vault): bool { v.is_archived }

    // Type constant accessors
    public fun type_note(): u8 { VAULT_NOTE }
    public fun type_file(): u8 { VAULT_FILE }
}
