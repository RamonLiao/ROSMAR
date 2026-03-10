module crm_action::airdrop {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;
    use crm_core::capabilities::{Self, GlobalConfig, WorkspaceAdminCap};
    use crm_core::workspace::{Self, Workspace};

    // Errors
    const EEmptyRecipients: u64 = 1300;
    const EInsufficientFunds: u64 = 1301;
    const EBatchTooLarge: u64 = 1302;

    // Limits
    const MAX_BATCH_SIZE: u64 = 500;

    // AuditEvent constants
    const ACTION_CREATE: u8 = 0;
    const OBJECT_AIRDROP: u8 = 9;

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

    public struct AirdropExecuted has copy, drop {
        workspace_id: ID,
        recipient_count: u64,
        amount_per_recipient: u64,
        total_amount: u64,
    }

    // ===== Public functions =====

    /// @notice Batch airdrop equal amounts of SUI to a list of addresses
    /// @param config - Global configuration (pause guard)
    /// @param workspace - Target workspace
    /// @param cap - Workspace admin capability
    /// @param recipients - List of recipient addresses
    /// @param fund - SUI coin to split from
    /// @param amount_per_recipient - Amount each recipient receives
    /// @emits AirdropExecuted
    /// @emits AuditEventV1
    /// @aborts EEmptyRecipients - if recipients list is empty
    /// @aborts EInsufficientFunds - if fund balance < total needed
    public fun batch_airdrop(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        recipients: vector<address>,
        mut fund: Coin<SUI>,
        amount_per_recipient: u64,
        ctx: &mut TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));

        let recipient_count = recipients.length();
        assert!(recipient_count > 0, EEmptyRecipients);
        assert!(recipient_count <= MAX_BATCH_SIZE, EBatchTooLarge);

        let total_needed = amount_per_recipient * recipient_count;
        assert!(coin::value(&fund) >= total_needed, EInsufficientFunds);

        let mut i = 0;
        while (i < recipient_count) {
            let payment = coin::split(&mut fund, amount_per_recipient, ctx);
            transfer::public_transfer(payment, recipients[i]);
            i = i + 1;
        };

        // Return remaining funds to sender
        if (coin::value(&fund) > 0) {
            transfer::public_transfer(fund, ctx.sender());
        } else {
            coin::destroy_zero(fund);
        };

        event::emit(AirdropExecuted {
            workspace_id: workspace::id(workspace),
            recipient_count,
            amount_per_recipient,
            total_amount: total_needed,
        });

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: workspace::id(workspace),
            actor: ctx.sender(),
            action: ACTION_CREATE,
            object_type: OBJECT_AIRDROP,
            object_id: workspace::id(workspace),
            timestamp: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    /// @notice Batch airdrop with variable amounts per recipient
    /// @param config - Global configuration (pause guard)
    /// @param workspace - Target workspace
    /// @param cap - Workspace admin capability
    /// @param recipients - List of recipient addresses
    /// @param amounts - Per-recipient amounts (must match recipients length)
    /// @param fund - SUI coin to split from
    /// @emits AirdropExecuted
    /// @aborts EEmptyRecipients - if recipients list is empty or lengths mismatch
    public fun batch_airdrop_variable(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        recipients: vector<address>,
        amounts: vector<u64>,
        mut fund: Coin<SUI>,
        ctx: &mut TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));

        let recipient_count = recipients.length();
        assert!(recipient_count > 0, EEmptyRecipients);
        assert!(recipient_count <= MAX_BATCH_SIZE, EBatchTooLarge);
        assert!(recipient_count == amounts.length(), EEmptyRecipients);

        let mut total = 0u64;
        let mut i = 0;
        while (i < recipient_count) {
            let payment = coin::split(&mut fund, amounts[i], ctx);
            transfer::public_transfer(payment, recipients[i]);
            total = total + amounts[i];
            i = i + 1;
        };

        if (coin::value(&fund) > 0) {
            transfer::public_transfer(fund, ctx.sender());
        } else {
            coin::destroy_zero(fund);
        };

        event::emit(AirdropExecuted {
            workspace_id: workspace::id(workspace),
            recipient_count,
            amount_per_recipient: 0,
            total_amount: total,
        });
    }
}
