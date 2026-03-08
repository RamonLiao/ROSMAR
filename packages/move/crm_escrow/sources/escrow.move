module crm_escrow::escrow {
    use std::string::String;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::clock::Clock;
    use sui::event;
    use sui::dynamic_field;
    use sui::hash;
    use crm_core::capabilities::{Self, GlobalConfig, WorkspaceAdminCap};
    use crm_core::workspace::{Self, Workspace};
    use crm_escrow::vesting;
    use crm_escrow::arbitration;

    // ===== State constants =====
    const STATE_CREATED: u8 = 0;
    const STATE_FUNDED: u8 = 1;
    const STATE_PARTIALLY_RELEASED: u8 = 2;
    const STATE_COMPLETED: u8 = 3;
    const STATE_REFUNDED: u8 = 4;
    const STATE_DISPUTED: u8 = 5;

    // ===== Error codes (1500+) =====
    const ENotPayer: u64 = 1500;
    const ENotPayee: u64 = 1501;
    const ENotArbitrator: u64 = 1502;
    const EInvalidStateTransition: u64 = 1503;
    const EOverRelease: u64 = 1504;
    const EVestingAlreadySet: u64 = 1505;
    const EMilestonePercentageMismatch: u64 = 1506;
    const EInvalidThreshold: u64 = 1507;
    const EAlreadyVoted: u64 = 1508;
    const ENotExpired: u64 = 1509;
    #[allow(unused_const)]
    const EEscrowExpired: u64 = 1510;
    const EArbitratorIsPayer: u64 = 1511;
    const EArbitratorIsPayee: u64 = 1512;
    const EMinLockDuration: u64 = 1513;
    const ENotInClaimWindow: u64 = 1515;
    const ECommitmentExists: u64 = 1520;
    const ENoCommitment: u64 = 1521;
    const ERevealMismatch: u64 = 1522;
    const ERevealDeadlinePassed: u64 = 1523;
    #[allow(unused_const)]
    const ECommitPhaseClosed: u64 = 1524;

    const MIN_LOCK_DURATION_MS: u64 = 3_600_000; // 1 hour
    const CLAIM_WINDOW_MS: u64 = 24 * 60 * 60 * 1000; // 24 hours

    // AuditEvent constants
    const ACTION_CREATE: u8 = 0;
    const OBJECT_ESCROW: u8 = 15;

    // Dynamic field keys
    const VESTING_KEY: vector<u8> = b"vesting";
    const ARBITRATION_KEY: vector<u8> = b"arbitration";

    // ===== Structs =====

    public struct Escrow has key {
        id: UID,
        workspace_id: ID,
        deal_id: ID,
        payer: address,
        payee: address,
        balance: Balance<SUI>,
        released_amount: u64,
        refunded_amount: u64,
        state: u8,
        has_vesting: bool,
        arbitrators: vector<address>,
        arbiter_threshold: u64,
        expiry_ms: Option<u64>,
        created_at: u64,
        funded_at: u64,
        version: u64,
    }

    public struct VestingSchedule has store {
        vesting_type: u8,
        cliff_ms: u64,
        total_duration_ms: u64,
        milestones: vector<Milestone>,
        start_time: u64,
    }

    public struct Milestone has store, copy, drop {
        description: String,
        percentage: u64,
        is_completed: bool,
        completed_at: u64,
    }

    public struct ArbitrationState has store {
        votes_release: vector<address>,
        votes_refund: vector<address>,
        resolved: bool,
        resolution: u8,
        commitments: vector<address>,
        commitment_hashes: vector<vector<u8>>,
        reveal_deadline_ms: u64,
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

    public struct EscrowCreated has copy, drop {
        workspace_id: ID,
        escrow_id: ID,
        actor: address,
        timestamp: u64,
    }

    public struct EscrowFunded has copy, drop {
        workspace_id: ID,
        escrow_id: ID,
        actor: address,
        amount: u64,
        timestamp: u64,
    }

    public struct EscrowReleased has copy, drop {
        workspace_id: ID,
        escrow_id: ID,
        actor: address,
        amount: u64,
        timestamp: u64,
    }

    public struct EscrowRefunded has copy, drop {
        workspace_id: ID,
        escrow_id: ID,
        actor: address,
        amount: u64,
        timestamp: u64,
    }

    public struct MilestoneCompleted has copy, drop {
        workspace_id: ID,
        escrow_id: ID,
        actor: address,
        milestone_index: u64,
        timestamp: u64,
    }

    public struct DisputeRaised has copy, drop {
        workspace_id: ID,
        escrow_id: ID,
        actor: address,
        timestamp: u64,
    }

    public struct DisputeVoteCast has copy, drop {
        workspace_id: ID,
        escrow_id: ID,
        actor: address,
        vote: u8,
        timestamp: u64,
    }

    public struct DisputeResolved has copy, drop {
        workspace_id: ID,
        escrow_id: ID,
        actor: address,
        resolution: u8,
        timestamp: u64,
    }

    // ===== Internal helpers =====

    fun assert_state(escrow: &Escrow, expected: u8) {
        assert!(escrow.state == expected, EInvalidStateTransition);
    }

    fun assert_state_one_of(escrow: &Escrow, s1: u8, s2: u8) {
        assert!(escrow.state == s1 || escrow.state == s2, EInvalidStateTransition);
    }

    fun assert_is_payer(escrow: &Escrow, ctx: &TxContext) {
        assert!(ctx.sender() == escrow.payer, ENotPayer);
    }

    fun assert_is_payer_or_payee(escrow: &Escrow, ctx: &TxContext) {
        assert!(ctx.sender() == escrow.payer || ctx.sender() == escrow.payee, ENotPayer);
    }

    fun arb_has_voted(arb: &ArbitrationState, voter: address): bool {
        let mut i = 0;
        while (i < arb.votes_release.length()) {
            if (arb.votes_release[i] == voter) { return true };
            i = i + 1;
        };
        let mut j = 0;
        while (j < arb.votes_refund.length()) {
            if (arb.votes_refund[j] == voter) { return true };
            j = j + 1;
        };
        false
    }

    fun has_committed(arb: &ArbitrationState, addr: address): bool {
        let mut i = 0;
        while (i < arb.commitments.length()) {
            if (arb.commitments[i] == addr) { return true };
            i = i + 1;
        };
        false
    }

    fun find_commitment_index(arb: &ArbitrationState, addr: address): u64 {
        let mut i = 0;
        while (i < arb.commitments.length()) {
            if (arb.commitments[i] == addr) { return i };
            i = i + 1;
        };
        abort ENoCommitment
    }

    fun arb_threshold_reached(arb: &ArbitrationState, threshold: u64): Option<u8> {
        if (arb.votes_release.length() >= threshold) {
            option::some(arbitration::decision_release())
        } else if (arb.votes_refund.length() >= threshold) {
            option::some(arbitration::decision_refund())
        } else {
            option::none()
        }
    }

    fun calc_milestone_completed_bp(milestones: &vector<Milestone>): u64 {
        let mut completed_bp: u64 = 0;
        let len = milestones.length();
        let mut i = 0;
        while (i < len) {
            if (milestones[i].is_completed) {
                completed_bp = completed_bp + milestones[i].percentage;
            };
            i = i + 1;
        };
        completed_bp
    }

    fun assert_milestones_valid(milestones: &vector<Milestone>) {
        let mut sum: u64 = 0;
        let len = milestones.length();
        let mut i = 0;
        while (i < len) {
            sum = sum + milestones[i].percentage;
            i = i + 1;
        };
        assert!(sum == vesting::basis_points_total(), EMilestonePercentageMismatch);
    }

    // ===== Entry functions =====

    /// Create a new escrow (shared object)
    public fun create_escrow(
        config: &GlobalConfig,
        workspace: &Workspace,
        cap: &WorkspaceAdminCap,
        deal_id: ID,
        payee: address,
        arbitrators: vector<address>,
        arbiter_threshold: u64,
        expiry_ms: Option<u64>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        capabilities::assert_not_paused(config);
        capabilities::assert_cap_matches(cap, workspace::id(workspace));

        let sender = ctx.sender();
        let arb_len = arbitrators.length();

        // Validate threshold
        if (arb_len > 0) {
            assert!(arbiter_threshold >= 1 && arbiter_threshold <= arb_len, EInvalidThreshold);
        };

        // Validate arbitrators not payer/payee
        let mut i = 0;
        while (i < arb_len) {
            assert!(arbitrators[i] != sender, EArbitratorIsPayer);
            assert!(arbitrators[i] != payee, EArbitratorIsPayee);
            i = i + 1;
        };

        let now = clock.timestamp_ms();

        // Validate expiry if set
        if (expiry_ms.is_some()) {
            let exp = *expiry_ms.borrow();
            assert!(exp >= now + MIN_LOCK_DURATION_MS, EMinLockDuration);
        };

        let escrow = Escrow {
            id: object::new(ctx),
            workspace_id: workspace::id(workspace),
            deal_id,
            payer: sender,
            payee,
            balance: balance::zero(),
            released_amount: 0,
            refunded_amount: 0,
            state: STATE_CREATED,
            has_vesting: false,
            arbitrators,
            arbiter_threshold,
            expiry_ms,
            created_at: now,
            funded_at: 0,
            version: 1,
        };

        let escrow_id = object::id(&escrow);
        let ws_id = workspace::id(workspace);

        event::emit(EscrowCreated {
            workspace_id: ws_id,
            escrow_id,
            actor: sender,
            timestamp: now,
        });

        event::emit(AuditEventV1 {
            version: 1,
            workspace_id: ws_id,
            actor: sender,
            action: ACTION_CREATE,
            object_type: OBJECT_ESCROW,
            object_id: escrow_id,
            timestamp: now,
        });

        transfer::share_object(escrow);
    }

    /// Fund an escrow with SUI coins
    public fun fund_escrow(
        escrow: &mut Escrow,
        coin: Coin<SUI>,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert_state(escrow, STATE_CREATED);
        assert_is_payer(escrow, ctx);
        assert!(coin::value(&coin) > 0, EOverRelease);

        let amount = coin::value(&coin);
        balance::join(&mut escrow.balance, coin::into_balance(coin));
        escrow.state = STATE_FUNDED;
        escrow.funded_at = clock.timestamp_ms();

        let now = clock.timestamp_ms();
        event::emit(EscrowFunded {
            workspace_id: escrow.workspace_id,
            escrow_id: object::id(escrow),
            actor: ctx.sender(),
            amount,
            timestamp: now,
        });
    }

    /// Release funds to payee
    public fun release(
        escrow: &mut Escrow,
        amount: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_state_one_of(escrow, STATE_FUNDED, STATE_PARTIALLY_RELEASED);
        assert_is_payer(escrow, ctx);

        let now = clock.timestamp_ms();
        assert!(now - escrow.funded_at >= MIN_LOCK_DURATION_MS, EMinLockDuration);
        assert!(amount <= balance::value(&escrow.balance), EOverRelease);

        let payment = coin::from_balance(balance::split(&mut escrow.balance, amount), ctx);
        transfer::public_transfer(payment, escrow.payee);

        escrow.released_amount = escrow.released_amount + amount;

        if (balance::value(&escrow.balance) == 0) {
            escrow.state = STATE_COMPLETED;
        } else {
            escrow.state = STATE_PARTIALLY_RELEASED;
        };

        event::emit(EscrowReleased {
            workspace_id: escrow.workspace_id,
            escrow_id: object::id(escrow),
            actor: ctx.sender(),
            amount,
            timestamp: now,
        });
    }

    /// Payee can claim remaining balance within 24h window before expiry.
    /// This protects the payee from a last-second payer refund.
    public fun claim_before_expiry(
        escrow: &mut Escrow,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_state_one_of(escrow, STATE_FUNDED, STATE_PARTIALLY_RELEASED);
        assert!(ctx.sender() == escrow.payee, ENotPayee);
        assert!(escrow.expiry_ms.is_some(), ENotExpired);

        let now = clock.timestamp_ms();
        let expiry = *escrow.expiry_ms.borrow();
        // Claim window: [expiry - 24h, expiry)
        assert!(expiry >= CLAIM_WINDOW_MS, ENotInClaimWindow); // prevent underflow
        let window_start = expiry - CLAIM_WINDOW_MS;
        assert!(now >= window_start && now < expiry, ENotInClaimWindow);

        let remaining = balance::value(&escrow.balance);
        assert!(remaining > 0, EOverRelease);

        let payment = coin::from_balance(
            balance::split(&mut escrow.balance, remaining),
            ctx,
        );
        transfer::public_transfer(payment, escrow.payee);

        escrow.released_amount = escrow.released_amount + remaining;
        escrow.state = STATE_COMPLETED;

        event::emit(EscrowReleased {
            workspace_id: escrow.workspace_id,
            escrow_id: object::id(escrow),
            actor: ctx.sender(),
            amount: remaining,
            timestamp: now,
        });
    }

    /// Refund remaining balance to payer
    public fun refund(
        escrow: &mut Escrow,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_is_payer(escrow, ctx);

        let now = clock.timestamp_ms();

        // Allow refund if: CREATED, expired, or (FUNDED/PARTIALLY_RELEASED with no expiry set)
        let is_unfunded = escrow.state == STATE_CREATED;
        let is_expired = escrow.expiry_ms.is_some() && now >= *escrow.expiry_ms.borrow();
        let is_funded_no_expiry = (escrow.state == STATE_FUNDED || escrow.state == STATE_PARTIALLY_RELEASED)
            && escrow.expiry_ms.is_none();

        assert!(is_unfunded || is_expired || is_funded_no_expiry, EInvalidStateTransition);

        let remaining = balance::value(&escrow.balance);
        if (remaining > 0) {
            let refund_coin = coin::from_balance(
                balance::split(&mut escrow.balance, remaining),
                ctx,
            );
            transfer::public_transfer(refund_coin, escrow.payer);
        };

        escrow.refunded_amount = escrow.refunded_amount + remaining;
        escrow.state = STATE_REFUNDED;

        event::emit(EscrowRefunded {
            workspace_id: escrow.workspace_id,
            escrow_id: object::id(escrow),
            actor: ctx.sender(),
            amount: remaining,
            timestamp: now,
        });
    }

    // ===== Vesting functions =====

    /// Add a vesting schedule to a funded escrow
    public fun add_vesting(
        escrow: &mut Escrow,
        vesting_type: u8,
        cliff_ms: u64,
        total_duration_ms: u64,
        milestones: vector<Milestone>,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert_state(escrow, STATE_FUNDED);
        assert_is_payer(escrow, ctx);
        assert!(!escrow.has_vesting, EVestingAlreadySet);

        if (vesting_type == vesting::milestone_type()) {
            assert_milestones_valid(&milestones);
        };

        let schedule = VestingSchedule {
            vesting_type,
            cliff_ms,
            total_duration_ms,
            milestones,
            start_time: clock.timestamp_ms(),
        };

        dynamic_field::add(&mut escrow.id, VESTING_KEY, schedule);
        escrow.has_vesting = true;
    }

    /// Release vested amount to payee
    public fun release_vested(
        escrow: &mut Escrow,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_state_one_of(escrow, STATE_FUNDED, STATE_PARTIALLY_RELEASED);
        assert_is_payer(escrow, ctx);
        assert!(escrow.has_vesting, EInvalidStateTransition);

        let now = clock.timestamp_ms();
        let total_funded = balance::value(&escrow.balance) + escrow.released_amount;
        let schedule: &VestingSchedule = dynamic_field::borrow(&escrow.id, VESTING_KEY);

        let releasable = if (schedule.vesting_type == vesting::linear_type()) {
            let elapsed = if (now > schedule.start_time) {
                now - schedule.start_time
            } else {
                0
            };
            if (elapsed < schedule.cliff_ms) {
                0
            } else {
                vesting::calc_linear_vested(total_funded, elapsed, schedule.total_duration_ms)
            }
        } else {
            let completed_bp = calc_milestone_completed_bp(&schedule.milestones);
            vesting::calc_milestone_vested_from_bp(total_funded, completed_bp)
        };

        // Subtract already released
        let to_release = if (releasable > escrow.released_amount) {
            releasable - escrow.released_amount
        } else {
            0
        };

        assert!(to_release > 0, EOverRelease);
        assert!(to_release <= balance::value(&escrow.balance), EOverRelease);

        let payment = coin::from_balance(balance::split(&mut escrow.balance, to_release), ctx);
        transfer::public_transfer(payment, escrow.payee);

        escrow.released_amount = escrow.released_amount + to_release;

        if (balance::value(&escrow.balance) == 0) {
            escrow.state = STATE_COMPLETED;
        } else {
            escrow.state = STATE_PARTIALLY_RELEASED;
        };

        event::emit(EscrowReleased {
            workspace_id: escrow.workspace_id,
            escrow_id: object::id(escrow),
            actor: ctx.sender(),
            amount: to_release,
            timestamp: now,
        });
    }

    /// Complete a milestone
    public fun complete_milestone(
        escrow: &mut Escrow,
        milestone_index: u64,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert_state_one_of(escrow, STATE_FUNDED, STATE_PARTIALLY_RELEASED);
        assert_is_payer(escrow, ctx);
        assert!(escrow.has_vesting, EInvalidStateTransition);

        let now = clock.timestamp_ms();
        let schedule: &mut VestingSchedule = dynamic_field::borrow_mut(&mut escrow.id, VESTING_KEY);
        let milestone = &mut schedule.milestones[milestone_index];
        milestone.is_completed = true;
        milestone.completed_at = now;

        event::emit(MilestoneCompleted {
            workspace_id: escrow.workspace_id,
            escrow_id: object::id(escrow),
            actor: ctx.sender(),
            milestone_index,
            timestamp: now,
        });
    }

    // ===== Arbitration functions =====

    /// Raise a dispute on the escrow
    public fun raise_dispute(
        escrow: &mut Escrow,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert_state_one_of(escrow, STATE_FUNDED, STATE_PARTIALLY_RELEASED);
        assert_is_payer_or_payee(escrow, ctx);

        let now = clock.timestamp_ms();

        let arb_state = ArbitrationState {
            votes_release: vector[],
            votes_refund: vector[],
            resolved: false,
            resolution: 0,
            commitments: vector[],
            commitment_hashes: vector[],
            reveal_deadline_ms: 0,
        };

        dynamic_field::add(&mut escrow.id, ARBITRATION_KEY, arb_state);
        escrow.state = STATE_DISPUTED;

        event::emit(DisputeRaised {
            workspace_id: escrow.workspace_id,
            escrow_id: object::id(escrow),
            actor: ctx.sender(),
            timestamp: now,
        });
    }

    /// Vote on a dispute
    public fun vote_on_dispute(
        escrow: &mut Escrow,
        vote: u8,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_state(escrow, STATE_DISPUTED);

        let sender = ctx.sender();
        let now = clock.timestamp_ms();

        // Check sender is an arbitrator
        let mut is_arb = false;
        let mut i = 0;
        while (i < escrow.arbitrators.length()) {
            if (escrow.arbitrators[i] == sender) {
                is_arb = true;
            };
            i = i + 1;
        };
        assert!(is_arb, ENotArbitrator);

        // Cache IDs before mutable borrow
        let ws_id = escrow.workspace_id;
        let escrow_id = object::id(escrow);
        let payee = escrow.payee;
        let payer = escrow.payer;
        let threshold = escrow.arbiter_threshold;

        let arb_state: &mut ArbitrationState = dynamic_field::borrow_mut(
            &mut escrow.id,
            ARBITRATION_KEY,
        );

        assert!(!arb_has_voted(arb_state, sender), EAlreadyVoted);

        // Record vote
        if (vote == arbitration::decision_release()) {
            arb_state.votes_release.push_back(sender);
        } else {
            arb_state.votes_refund.push_back(sender);
        };

        event::emit(DisputeVoteCast {
            workspace_id: ws_id,
            escrow_id,
            actor: sender,
            vote,
            timestamp: now,
        });

        // Check if threshold reached
        let maybe_decision = arb_threshold_reached(arb_state, threshold);
        if (maybe_decision.is_some()) {
            let decision = *maybe_decision.borrow();
            arb_state.resolved = true;
            arb_state.resolution = decision;

            // Release the mutable borrow on dynamic field before accessing escrow.balance
            let remaining = balance::value(&escrow.balance);
            if (remaining > 0) {
                let payout = coin::from_balance(
                    balance::split(&mut escrow.balance, remaining),
                    ctx,
                );
                if (decision == arbitration::decision_release()) {
                    transfer::public_transfer(payout, payee);
                    escrow.released_amount = escrow.released_amount + remaining;
                    escrow.state = STATE_COMPLETED;
                } else {
                    transfer::public_transfer(payout, payer);
                    escrow.refunded_amount = escrow.refunded_amount + remaining;
                    escrow.state = STATE_REFUNDED;
                };
            };

            event::emit(DisputeResolved {
                workspace_id: ws_id,
                escrow_id,
                actor: sender,
                resolution: decision,
                timestamp: now,
            });
        };
    }

    /// Arbitrator commits a hash of their vote (commit-reveal mode)
    public fun commit_vote(
        escrow: &mut Escrow,
        commitment_hash: vector<u8>,
        reveal_deadline_ms: u64,
        _clock: &Clock,
        ctx: &TxContext,
    ) {
        assert_state(escrow, STATE_DISPUTED);

        let sender = ctx.sender();

        // Check sender is an arbitrator
        let mut is_arb = false;
        let mut i = 0;
        while (i < escrow.arbitrators.length()) {
            if (escrow.arbitrators[i] == sender) {
                is_arb = true;
            };
            i = i + 1;
        };
        assert!(is_arb, ENotArbitrator);

        let arb_state: &mut ArbitrationState = dynamic_field::borrow_mut(
            &mut escrow.id,
            ARBITRATION_KEY,
        );

        // Must not have already voted or committed
        assert!(!arb_has_voted(arb_state, sender), EAlreadyVoted);
        assert!(!has_committed(arb_state, sender), ECommitmentExists);

        arb_state.commitments.push_back(sender);
        arb_state.commitment_hashes.push_back(commitment_hash);
        // Update reveal deadline if later than current
        if (reveal_deadline_ms > arb_state.reveal_deadline_ms) {
            arb_state.reveal_deadline_ms = reveal_deadline_ms;
        };
    }

    /// Arbitrator reveals their vote (commit-reveal mode)
    public fun reveal_vote(
        escrow: &mut Escrow,
        vote: u8,
        salt: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_state(escrow, STATE_DISPUTED);

        let sender = ctx.sender();
        let now = clock.timestamp_ms();

        // Cache IDs before mutable borrow
        let ws_id = escrow.workspace_id;
        let escrow_id = object::id(escrow);
        let payee = escrow.payee;
        let payer = escrow.payer;
        let threshold = escrow.arbiter_threshold;

        let arb_state: &mut ArbitrationState = dynamic_field::borrow_mut(
            &mut escrow.id,
            ARBITRATION_KEY,
        );

        // Must have committed
        assert!(has_committed(arb_state, sender), ENoCommitment);

        // Must be before reveal deadline
        assert!(now < arb_state.reveal_deadline_ms, ERevealDeadlinePassed);

        // Verify hash: keccak256(vote_byte || salt)
        let mut data = vector[vote];
        data.append(salt);
        let computed = hash::keccak256(&data);

        let idx = find_commitment_index(arb_state, sender);
        assert!(computed == arb_state.commitment_hashes[idx], ERevealMismatch);

        // Remove commitment (swap-remove)
        arb_state.commitments.swap_remove(idx);
        arb_state.commitment_hashes.swap_remove(idx);

        // Record vote (same logic as vote_on_dispute)
        if (vote == arbitration::decision_release()) {
            arb_state.votes_release.push_back(sender);
        } else {
            arb_state.votes_refund.push_back(sender);
        };

        event::emit(DisputeVoteCast {
            workspace_id: ws_id,
            escrow_id,
            actor: sender,
            vote,
            timestamp: now,
        });

        // Check if threshold reached
        let maybe_decision = arb_threshold_reached(arb_state, threshold);
        if (maybe_decision.is_some()) {
            let decision = *maybe_decision.borrow();
            arb_state.resolved = true;
            arb_state.resolution = decision;

            let remaining = balance::value(&escrow.balance);
            if (remaining > 0) {
                let payout = coin::from_balance(
                    balance::split(&mut escrow.balance, remaining),
                    ctx,
                );
                if (decision == arbitration::decision_release()) {
                    transfer::public_transfer(payout, payee);
                    escrow.released_amount = escrow.released_amount + remaining;
                    escrow.state = STATE_COMPLETED;
                } else {
                    transfer::public_transfer(payout, payer);
                    escrow.refunded_amount = escrow.refunded_amount + remaining;
                    escrow.state = STATE_REFUNDED;
                };
            };

            event::emit(DisputeResolved {
                workspace_id: ws_id,
                escrow_id,
                actor: sender,
                resolution: decision,
                timestamp: now,
            });
        };
    }

    // ===== Accessors =====

    public fun state(e: &Escrow): u8 { e.state }
    public fun payer(e: &Escrow): address { e.payer }
    public fun payee(e: &Escrow): address { e.payee }
    public fun balance_value(e: &Escrow): u64 { balance::value(&e.balance) }
    public fun released_amount(e: &Escrow): u64 { e.released_amount }
    public fun refunded_amount(e: &Escrow): u64 { e.refunded_amount }
    public fun escrow_workspace_id(e: &Escrow): ID { e.workspace_id }
    public fun has_vesting(e: &Escrow): bool { e.has_vesting }
    public fun funded_at(e: &Escrow): u64 { e.funded_at }

    public fun state_created(): u8 { STATE_CREATED }
    public fun state_funded(): u8 { STATE_FUNDED }
    public fun state_partially_released(): u8 { STATE_PARTIALLY_RELEASED }
    public fun state_completed(): u8 { STATE_COMPLETED }
    public fun state_refunded(): u8 { STATE_REFUNDED }
    public fun state_disputed(): u8 { STATE_DISPUTED }

    // ===== Milestone constructor =====

    public fun new_milestone(description: String, percentage: u64): Milestone {
        Milestone {
            description,
            percentage,
            is_completed: false,
            completed_at: 0,
        }
    }

    public fun milestone_is_completed(m: &Milestone): bool { m.is_completed }
    public fun milestone_percentage(m: &Milestone): u64 { m.percentage }

    // ===== Test-only helpers =====

    #[test_only]
    public fun test_create_escrow(
        payer: address,
        payee: address,
        arbitrators: vector<address>,
        arbiter_threshold: u64,
        expiry_ms: Option<u64>,
        ctx: &mut TxContext,
    ): Escrow {
        Escrow {
            id: object::new(ctx),
            workspace_id: object::id_from_address(@0x999),
            deal_id: object::id_from_address(@0x888),
            payer,
            payee,
            balance: balance::zero(),
            released_amount: 0,
            refunded_amount: 0,
            state: STATE_CREATED,
            has_vesting: false,
            arbitrators,
            arbiter_threshold,
            expiry_ms,
            created_at: 0,
            funded_at: 0,
            version: 1,
        }
    }

    #[test_only]
    public fun test_set_state(escrow: &mut Escrow, s: u8) {
        escrow.state = s;
    }

    #[test_only]
    public fun test_set_funded_at(escrow: &mut Escrow, t: u64) {
        escrow.funded_at = t;
    }

    #[test_only]
    public fun test_fund_balance(escrow: &mut Escrow, coin: Coin<SUI>) {
        balance::join(&mut escrow.balance, coin::into_balance(coin));
    }

    #[test_only]
    public fun test_destroy_escrow(escrow: Escrow) {
        let Escrow {
            id,
            workspace_id: _,
            deal_id: _,
            payer: _,
            payee: _,
            balance: bal,
            released_amount: _,
            refunded_amount: _,
            state: _,
            has_vesting: _,
            arbitrators: _,
            arbiter_threshold: _,
            expiry_ms: _,
            created_at: _,
            funded_at: _,
            version: _,
        } = escrow;
        balance::destroy_for_testing(bal);
        object::delete(id);
    }
}
