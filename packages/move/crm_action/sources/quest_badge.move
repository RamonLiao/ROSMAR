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

    // AuditEvent constants
    const ACTION_CREATE: u8 = 0;
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

    /// Shared registry for deduplication
    public struct QuestRegistry has key {
        id: UID,
        minted: Table<vector<u8>, ID>,
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
        };
        transfer::share_object(registry);
    }

    // ===== Public functions =====

    /// Mint a quest badge SBT to a recipient
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

    // ===== Accessors =====

    public fun quest_id(badge: &QuestBadge): &vector<u8> { &badge.quest_id }
    public fun badge_workspace_id(badge: &QuestBadge): ID { badge.workspace_id }
    public fun tier(badge: &QuestBadge): u8 { badge.tier }
    public fun is_complete(badge: &QuestBadge): bool { badge.completed_steps >= badge.total_steps }
    public fun completed_at(badge: &QuestBadge): u64 { badge.completed_at }
    public fun completed_steps(badge: &QuestBadge): u64 { badge.completed_steps }
    public fun total_steps(badge: &QuestBadge): u64 { badge.total_steps }
    public fun issuer(badge: &QuestBadge): address { badge.issuer }

    // ===== Helpers =====

    /// Create a unique dedup key from quest_id + recipient using BCS serialization
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
        }
    }

    #[test_only]
    public fun test_destroy_registry(registry: QuestRegistry) {
        let QuestRegistry { id, minted } = registry;
        table::drop(minted);
        object::delete(id);
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
