module crm_action::reward {
    use std::string::String;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;
    use crm_core::capabilities::{Self, GlobalConfig, WorkspaceAdminCap};
    use crm_core::workspace::{Self, Workspace};
    use crm_data::campaign::{Self, Campaign};

    // Errors
    const EWorkspaceMismatch: u64 = 1400;
    const ECampaignNotActive: u64 = 1401;
    const EInsufficientFunds: u64 = 1402;

    // AuditEvent constants
    const ACTION_CREATE: u8 = 0;
    const OBJECT_REWARD: u8 = 10;

    // ===== Structs =====

    /// Tracks reward distribution for a campaign
    public struct RewardRecord has key, store {
        id: UID,
        workspace_id: ID,
        campaign_id: ID,
        recipient: address,
        amount: u64,
        reward_type: String,
        created_at: u64,
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

    public struct RewardDistributed has copy, drop {
        workspace_id: ID,
        campaign_id: ID,
        recipient: address,
        amount: u64,
        reward_type: String,
    }

    // ===== Public functions =====

    /// Distribute reward to a single recipient based on active campaign
    public fun distribute(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        campaign_obj: &Campaign,
        recipient: address,
        amount: u64,
        reward_type: String,
        mut fund: Coin<SUI>,
        ctx: &mut TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(campaign::workspace_id(campaign_obj) == workspace::id(workspace), EWorkspaceMismatch);
        assert!(campaign::status(campaign_obj) == campaign::status_active(), ECampaignNotActive);
        assert!(coin::value(&fund) >= amount, EInsufficientFunds);

        let payment = coin::split(&mut fund, amount, ctx);
        transfer::public_transfer(payment, recipient);

        // Return remaining funds
        if (coin::value(&fund) > 0) {
            transfer::public_transfer(fund, ctx.sender());
        } else {
            coin::destroy_zero(fund);
        };

        let record = RewardRecord {
            id: object::new(ctx),
            workspace_id: workspace::id(workspace),
            campaign_id: object::id(campaign_obj),
            recipient,
            amount,
            reward_type,
            created_at: tx_context::epoch_timestamp_ms(ctx),
        };

        let record_id = object::id(&record);
        transfer::transfer(record, ctx.sender());

        event::emit(RewardDistributed {
            workspace_id: workspace::id(workspace),
            campaign_id: object::id(campaign_obj),
            recipient,
            amount,
            reward_type,
        });

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_CREATE,
            object_type: OBJECT_REWARD,
            object_id: record_id,
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    /// Batch distribute equal rewards to multiple recipients
    public fun batch_distribute(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        campaign_obj: &Campaign,
        recipients: vector<address>,
        amount_per_recipient: u64,
        reward_type: String,
        mut fund: Coin<SUI>,
        ctx: &mut TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));
        assert!(campaign::workspace_id(campaign_obj) == workspace::id(workspace), EWorkspaceMismatch);
        assert!(campaign::status(campaign_obj) == campaign::status_active(), ECampaignNotActive);

        let count = recipients.length();
        let total_needed = amount_per_recipient * count;
        assert!(coin::value(&fund) >= total_needed, EInsufficientFunds);

        let mut i = 0;
        while (i < count) {
            let payment = coin::split(&mut fund, amount_per_recipient, ctx);
            transfer::public_transfer(payment, recipients[i]);
            i = i + 1;
        };

        if (coin::value(&fund) > 0) {
            transfer::public_transfer(fund, ctx.sender());
        } else {
            coin::destroy_zero(fund);
        };

        event::emit(RewardDistributed {
            workspace_id: workspace::id(workspace),
            campaign_id: object::id(campaign_obj),
            recipient: @0x0,
            amount: total_needed,
            reward_type,
        });
    }

    // Accessors
    public fun record_workspace_id(r: &RewardRecord): ID { r.workspace_id }
    public fun record_campaign_id(r: &RewardRecord): ID { r.campaign_id }
    public fun record_recipient(r: &RewardRecord): address { r.recipient }
    public fun record_amount(r: &RewardRecord): u64 { r.amount }
}
