module crm_action::quest_badge {
    use std::string::String;
    use sui::package;
    use sui::display;
    use sui::event;
    use sui::table::{Self, Table};
    use sui::bcs;
    use crm_core::capabilities::{Self, GlobalConfig, WorkspaceAdminCap};
    use crm_core::workspace::{Self, Workspace};

    // Errors
    const EDuplicateBadge: u64 = 1600;
    const EAlreadyRevoked: u64 = 1602;
    const EBadgeNotFound: u64 = 1603;

    // AuditEvent constants
    const ACTION_CREATE: u8 = 0;
    const ACTION_DELETE: u8 = 2;
    const OBJECT_QUEST_BADGE: u8 = 16;

    // ===== OTW =====
    public struct QUEST_BADGE has drop {}

    // ===== Structs =====

    /// Soul-bound token — no `store` ability so it cannot be transferred after mint
    public struct QuestBadge has key {
        id: UID,
        workspace_id: ID,
        quest_id: vector<u8>,
        quest_name: String,
        completed_steps: u64,
        total_steps: u64,
        completed_at: u64,
        tier: u8,
        issuer: address,
    }

    /// Shared registry for deduplication and revocation tracking
    public struct QuestRegistry has key {
        id: UID,
        minted: Table<vector<u8>, ID>,
        /// Badge IDs that have been revoked by admin (soft revoke)
        revoked: Table<ID, bool>,
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

    public struct QuestBadgeMinted has copy, drop {
        workspace_id: ID,
        badge_id: ID,
        recipient: address,
        quest_id: vector<u8>,
        tier: u8,
        timestamp: u64,
    }

    public struct QuestBadgeRevoked has copy, drop {
        workspace_id: ID,
        badge_id: ID,
        actor: address,
        quest_id: vector<u8>,
        timestamp: u64,
    }

    public struct QuestBadgeBurned has copy, drop {
        workspace_id: ID,
        badge_id: ID,
        owner: address,
        quest_id: vector<u8>,
        timestamp: u64,
    }

    // ===== Init =====

    fun init(otw: QUEST_BADGE, ctx: &mut TxContext) {
        let publisher = package::claim(otw, ctx);

        let keys = vector[
            b"name".to_string(),
            b"description".to_string(),
            b"image_url".to_string(),
            b"project_url".to_string(),
        ];
        let values = vector[
            b"{quest_name}".to_string(),
            b"Quest Badge | Tier {tier} | Steps {completed_steps}/{total_steps}".to_string(),
            b"https://crm.rosmar.io/api/badge/{id}".to_string(),
            b"https://crm.rosmar.io/quests/{id}".to_string(),
        ];

        let mut badge_display = display::new_with_fields<QuestBadge>(
            &publisher, keys, values, ctx,
        );
        display::update_version(&mut badge_display);
        transfer::public_transfer(badge_display, ctx.sender());
        transfer::public_transfer(publisher, ctx.sender());

        let registry = QuestRegistry {
            id: object::new(ctx),
            minted: table::new(ctx),
            revoked: table::new(ctx),
        };
        transfer::share_object(registry);
    }

    // ===== Public functions =====

    /// @notice Mint a soul-bound quest badge (SBT) to a recipient
    /// @param config - Global configuration (pause guard)
    /// @param workspace - Target workspace
    /// @param cap - Workspace admin capability
    /// @param registry - Shared deduplication registry
    /// @param recipient - Address to receive the badge
    /// @param quest_id - Unique quest identifier bytes
    /// @param quest_name - Display name of the quest
    /// @param completed_steps - Steps the recipient completed
    /// @param total_steps - Total steps in the quest
    /// @param tier - Badge tier level
    /// @emits QuestBadgeMinted
    /// @emits AuditEventV1
    /// @aborts EDuplicateBadge - if badge already minted for this quest+recipient
    public fun mint_badge(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        registry: &mut QuestRegistry,
        recipient: address,
        quest_id: vector<u8>,
        quest_name: String,
        completed_steps: u64,
        total_steps: u64,
        tier: u8,
        ctx: &mut TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));

        // Dedup check
        let dedup_key = make_dedup_key(&quest_id, recipient);
        assert!(!table::contains(&registry.minted, dedup_key), EDuplicateBadge);

        let now = tx_context::epoch_timestamp_ms(ctx);
        let sender = ctx.sender();

        let badge = QuestBadge {
            id: object::new(ctx),
            workspace_id: workspace::id(workspace),
            quest_id,
            quest_name,
            completed_steps,
            total_steps,
            completed_at: now,
            tier,
            issuer: sender,
        };

        let badge_id = object::id(&badge);
        let ws_id = workspace::id(workspace);

        // Register dedup
        table::add(&mut registry.minted, dedup_key, badge_id);

        // Transfer to recipient (non-public_transfer since no store = SBT)
        transfer::transfer(badge, recipient);

        event::emit(QuestBadgeMinted {
            workspace_id: ws_id,
            badge_id,
            recipient,
            quest_id,
            tier,
            timestamp: now,
        });

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: ws_id,
            actor: sender,
            action: ACTION_CREATE,
            object_type: OBJECT_QUEST_BADGE,
            object_id: badge_id,
            timestamp: now,
        });
    }

    /// @notice Admin soft-revokes a badge by ID. The badge object still exists
    ///         (admin cannot destroy owned objects), but is marked revoked in the
    ///         shared registry. Removes the dedup entry so the quest can be re-minted.
    /// @param config - Global configuration (pause guard)
    /// @param workspace - Target workspace
    /// @param cap - Workspace admin capability
    /// @param registry - Shared deduplication + revocation registry
    /// @param badge_id - ID of the badge to revoke
    /// @param quest_id - Quest identifier bytes (for dedup key removal)
    /// @param recipient - Original recipient address (for dedup key removal)
    /// @emits QuestBadgeRevoked
    /// @emits AuditEventV1
    /// @aborts EAlreadyRevoked - if badge is already revoked
    /// @aborts EBadgeNotFound - if badge was never minted in this registry
    public fun revoke_badge(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        registry: &mut QuestRegistry,
        badge_id: ID,
        quest_id: vector<u8>,
        recipient: address,
        ctx: &TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));

        // Verify not already revoked (check first — dedup entry removed on revoke)
        assert!(!table::contains(&registry.revoked, badge_id), EAlreadyRevoked);

        // Verify badge was minted
        let dedup_key = make_dedup_key(&quest_id, recipient);
        assert!(table::contains(&registry.minted, dedup_key), EBadgeNotFound);

        // Mark revoked
        table::add(&mut registry.revoked, badge_id, true);

        // Remove dedup entry (allows re-minting)
        table::remove(&mut registry.minted, dedup_key);

        let now = tx_context::epoch_timestamp_ms(ctx);
        let sender = ctx.sender();

        event::emit(QuestBadgeRevoked {
            workspace_id: workspace::id(workspace),
            badge_id,
            actor: sender,
            quest_id,
            timestamp: now,
        });

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: sender,
            action: ACTION_DELETE,
            object_type: OBJECT_QUEST_BADGE,
            object_id: badge_id,
            timestamp: now,
        });
    }

    /// @notice Badge owner burns (destroys) their own badge. Removes the dedup
    ///         entry so the quest can be re-minted if needed.
    /// @param badge - The badge to burn (caller must be owner due to SUI ownership rules)
    /// @param registry - Shared registry for dedup cleanup
    /// @emits QuestBadgeBurned
    /// @aborts ENotBadgeOwner - if sender is not the badge issuer's workspace admin
    public fun burn_badge(
        badge: QuestBadge,
        registry: &mut QuestRegistry,
        ctx: &TxContext,
    ) {
        let badge_id = object::id(&badge);
        let QuestBadge {
            id,
            workspace_id,
            quest_id,
            quest_name: _,
            completed_steps: _,
            total_steps: _,
            completed_at: _,
            tier: _,
            issuer: _,
        } = badge;

        let sender = ctx.sender();

        // Remove dedup entry if it exists (may have been removed by revoke)
        let dedup_key = make_dedup_key(&quest_id, sender);
        if (table::contains(&registry.minted, dedup_key)) {
            table::remove(&mut registry.minted, dedup_key);
        };

        // Remove revocation entry if it exists
        if (table::contains(&registry.revoked, badge_id)) {
            table::remove(&mut registry.revoked, badge_id);
        };

        let now = tx_context::epoch_timestamp_ms(ctx);

        event::emit(QuestBadgeBurned {
            workspace_id,
            badge_id,
            owner: sender,
            quest_id,
            timestamp: now,
        });

        object::delete(id);
    }

    /// @notice Check if a badge ID has been revoked
    /// @param registry - Shared revocation registry
    /// @param badge_id - Badge ID to check
    public fun is_revoked(registry: &QuestRegistry, badge_id: ID): bool {
        table::contains(&registry.revoked, badge_id)
    }

    // ===== Accessors =====

    /// @notice Return the quest ID bytes
    public fun quest_id(badge: &QuestBadge): &vector<u8> { &badge.quest_id }
    /// @notice Return the workspace ID this badge belongs to
    public fun badge_workspace_id(badge: &QuestBadge): ID { badge.workspace_id }
    /// @notice Return the badge tier
    public fun tier(badge: &QuestBadge): u8 { badge.tier }
    /// @notice Return whether all quest steps are completed
    public fun is_complete(badge: &QuestBadge): bool { badge.completed_steps >= badge.total_steps }
    /// @notice Return the completion timestamp
    public fun completed_at(badge: &QuestBadge): u64 { badge.completed_at }
    /// @notice Return the number of completed steps
    public fun completed_steps(badge: &QuestBadge): u64 { badge.completed_steps }
    /// @notice Return the total number of steps
    public fun total_steps(badge: &QuestBadge): u64 { badge.total_steps }
    /// @notice Return the issuer address
    public fun issuer(badge: &QuestBadge): address { badge.issuer }

    // ===== Helpers =====

    /// @notice Create a unique dedup key from quest_id + recipient using BCS serialization
    /// @param quest_id - Quest identifier bytes
    /// @param recipient - Recipient address
    public fun make_dedup_key(quest_id: &vector<u8>, recipient: address): vector<u8> {
        let mut key = bcs::to_bytes(quest_id);
        let addr_bytes = bcs::to_bytes(&recipient);
        key.append(addr_bytes);
        key
    }

    // ===== Test-only =====

    #[test_only]
    public fun test_create_registry(ctx: &mut TxContext): QuestRegistry {
        QuestRegistry {
            id: object::new(ctx),
            minted: table::new(ctx),
            revoked: table::new(ctx),
        }
    }

    #[test_only]
    public fun test_destroy_registry(registry: QuestRegistry) {
        let QuestRegistry { id, minted, revoked } = registry;
        table::drop(minted);
        table::drop(revoked);
        object::delete(id);
    }

    #[test_only]
    public fun test_get_badge_id(registry: &QuestRegistry, quest_id: &vector<u8>, recipient: address): ID {
        let dedup_key = make_dedup_key(quest_id, recipient);
        *table::borrow(&registry.minted, dedup_key)
    }

    #[test_only]
    public fun test_share_registry(registry: QuestRegistry) {
        transfer::share_object(registry);
    }

    #[test_only]
    public fun test_destroy_badge(badge: QuestBadge) {
        let QuestBadge {
            id,
            workspace_id: _,
            quest_id: _,
            quest_name: _,
            completed_steps: _,
            total_steps: _,
            completed_at: _,
            tier: _,
            issuer: _,
        } = badge;
        object::delete(id);
    }
}
