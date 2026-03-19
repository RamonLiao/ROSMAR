module crm_core::capabilities {
    use std::string::String;
    use sui::table::{Self, Table};

    // ===== Error codes =====
    const EPaused: u64 = 0;
    const ENotOwner: u64 = 1;
    const ECapMismatch: u64 = 2;
    const EUserRateLimitExceeded: u64 = 101;

    // ===== Structs =====

    /// Global pause switch — shared object
    public struct GlobalConfig has key {
        id: UID,
        paused: bool,
        pause_reason: Option<String>,
    }

    /// Capability for workspace-level admin operations
    public struct WorkspaceAdminCap has key, store {
        id: UID,
        workspace_id: ID,
    }

    /// Capability for emergency pause
    public struct EmergencyPauseCap has key, store {
        id: UID,
    }

    /// Rate limiting per workspace
    public struct RateLimitConfig has key {
        id: UID,
        workspace_id: ID,
        max_operations_per_epoch: u64,
        current_epoch: u64,
        current_count: u64,
    }

    /// Per-user rate limiting within a workspace
    public struct PerUserRateLimit has key {
        id: UID,
        workspace_id: ID,
        max_per_epoch: u64,
        limits: Table<address, UserRateState>,
    }

    public struct UserRateState has store, drop {
        epoch: u64,
        count: u64,
    }

    // ===== Init =====

    fun init(ctx: &mut TxContext) {
        let config = GlobalConfig {
            id: object::new(ctx),
            paused: false,
            pause_reason: option::none(),
        };
        transfer::share_object(config);

        let pause_cap = EmergencyPauseCap {
            id: object::new(ctx),
        };
        transfer::transfer(pause_cap, ctx.sender());
    }

    // ===== Public functions =====

    /// @notice Asserts the system is not paused
    /// @param config - global config shared object
    /// @aborts EPaused - system is currently paused
    public fun assert_not_paused(config: &GlobalConfig) {
        assert!(!config.paused, EPaused);
    }

    /// @notice Pauses the system with a reason string
    /// @param config - global config shared object
    /// @param _cap - emergency pause capability (access control)
    /// @param reason - human-readable pause reason
    public fun pause(
        config: &mut GlobalConfig,
        _cap: &EmergencyPauseCap,
        reason: String,
    ) {
        config.paused = true;
        config.pause_reason = option::some(reason);
    }

    /// @notice Unpauses the system
    /// @param config - global config shared object
    /// @param _cap - emergency pause capability (access control)
    public fun unpause(
        config: &mut GlobalConfig,
        _cap: &EmergencyPauseCap,
    ) {
        config.paused = false;
        config.pause_reason = option::none();
    }

    /// @notice Returns whether the system is paused
    public fun is_paused(config: &GlobalConfig): bool {
        config.paused
    }

    // ===== AdminCap helpers =====

    /// @notice Creates a new WorkspaceAdminCap for the given workspace
    /// @param workspace_id - ID of the workspace this cap grants admin over
    public(package) fun create_admin_cap(
        workspace_id: ID,
        ctx: &mut TxContext,
    ): WorkspaceAdminCap {
        WorkspaceAdminCap {
            id: object::new(ctx),
            workspace_id,
        }
    }

    /// @notice Asserts the admin cap belongs to the given workspace
    /// @param cap - workspace admin capability
    /// @param workspace_id - expected workspace ID
    /// @aborts ECapMismatch - cap workspace_id does not match
    public fun assert_cap_matches(cap: &WorkspaceAdminCap, workspace_id: ID) {
        assert!(cap.workspace_id == workspace_id, ECapMismatch);
    }

    /// @notice Returns the workspace ID associated with an admin cap
    public fun cap_workspace_id(cap: &WorkspaceAdminCap): ID {
        cap.workspace_id
    }

    // ===== Package-internal pause control (for multi_sig_pause) =====

    /// @notice Package-internal function to set pause state (used by multi_sig_pause)
    /// @param config - global config shared object
    /// @param paused - new paused state
    /// @param reason - optional pause reason
    public(package) fun set_paused(
        config: &mut GlobalConfig,
        paused: bool,
        reason: Option<String>,
    ) {
        config.paused = paused;
        config.pause_reason = reason;
    }

    // ===== Rate limiting =====

    /// @notice Creates a per-workspace rate limit config
    /// @param workspace_id - workspace to rate-limit
    /// @param max_ops - max operations allowed per epoch
    public fun create_rate_limit(
        workspace_id: ID,
        max_ops: u64,
        ctx: &mut TxContext,
    ): RateLimitConfig {
        RateLimitConfig {
            id: object::new(ctx),
            workspace_id,
            max_operations_per_epoch: max_ops,
            current_epoch: 0,
            current_count: 0,
        }
    }

    /// @notice Increments and enforces the workspace rate limit for the current epoch
    /// @param rate - mutable rate limit config
    /// @param current_epoch - current Sui epoch number
    /// @aborts 100 - workspace rate limit exceeded
    public fun check_rate_limit(
        rate: &mut RateLimitConfig,
        current_epoch: u64,
    ) {
        if (rate.current_epoch != current_epoch) {
            rate.current_epoch = current_epoch;
            rate.current_count = 0;
        };
        assert!(rate.current_count < rate.max_operations_per_epoch, 100);
        rate.current_count = rate.current_count + 1;
    }

    // ===== Per-user rate limiting =====

    /// @notice Creates a per-user rate limit config for a workspace
    /// @param workspace_id - workspace to rate-limit
    /// @param max_per_epoch - max operations per user per epoch
    public fun create_per_user_rate_limit(
        workspace_id: ID,
        max_per_epoch: u64,
        ctx: &mut TxContext,
    ): PerUserRateLimit {
        PerUserRateLimit {
            id: object::new(ctx),
            workspace_id,
            max_per_epoch,
            limits: table::new(ctx),
        }
    }

    /// @notice Increments and enforces the per-user rate limit for the current epoch
    /// @param rate - mutable per-user rate limit config
    /// @param user - address of the user to check
    /// @param current_epoch - current Sui epoch number
    /// @aborts EUserRateLimitExceeded - user exceeded per-epoch limit
    public fun check_user_rate_limit(
        rate: &mut PerUserRateLimit,
        user: address,
        current_epoch: u64,
    ) {
        if (!table::contains(&rate.limits, user)) {
            table::add(&mut rate.limits, user, UserRateState {
                epoch: current_epoch,
                count: 0,
            });
        };
        let state = table::borrow_mut(&mut rate.limits, user);
        if (state.epoch != current_epoch) {
            state.epoch = current_epoch;
            state.count = 0;
        };
        assert!(state.count < rate.max_per_epoch, EUserRateLimitExceeded);
        state.count = state.count + 1;
    }

    // ===== Test-only helpers =====

    #[test_only]
    public fun test_create_config(ctx: &mut TxContext): GlobalConfig {
        GlobalConfig {
            id: object::new(ctx),
            paused: false,
            pause_reason: option::none(),
        }
    }

    #[test_only]
    public fun test_create_pause_cap(ctx: &mut TxContext): EmergencyPauseCap {
        EmergencyPauseCap {
            id: object::new(ctx),
        }
    }
}
