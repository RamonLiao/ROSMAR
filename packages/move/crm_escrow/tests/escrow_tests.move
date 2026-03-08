#[test_only]
module crm_escrow::escrow_tests {
    use std::string;
    use sui::test_scenario::{Self as ts};
    use sui::test_utils;
    use sui::coin;
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use crm_core::capabilities;
    use crm_core::workspace;
    use sui::hash;
    use crm_escrow::escrow;
    use crm_escrow::vesting;
    use crm_escrow::arbitration;

    const ADMIN: address = @0xA;
    const PAYER: address = @0xA;
    const PAYEE: address = @0xB;
    const ARB1: address = @0xC;
    const ARB2: address = @0xD;
    const ARB3: address = @0xE;
    const STRANGER: address = @0xF;

    // ========== Helper ==========

    fun setup_funded_escrow(
        clock: &Clock,
        ctx: &mut TxContext,
    ): escrow::Escrow {
        let mut e = escrow::test_create_escrow(
            PAYER, PAYEE,
            vector[ARB1, ARB2, ARB3],
            2, // threshold
            option::none(),
            ctx,
        );
        let fund = coin::mint_for_testing<SUI>(10000, ctx);
        escrow::test_fund_balance(&mut e, fund);
        escrow::test_set_state(&mut e, escrow::state_funded());
        escrow::test_set_funded_at(&mut e, clock.timestamp_ms());
        e
    }

    // ========== 1. test_create_and_fund_escrow ==========

    #[test]
    fun test_create_and_fund_escrow() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        escrow::create_escrow(
            &config, &workspace, &admin_cap,
            object::id_from_address(@0x111),
            PAYEE,
            vector[ARB1],
            1,
            option::none(),
            &clock,
            ctx,
        );

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========== 2. test_release_partial ==========

    #[test]
    fun test_release_partial() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let mut e = setup_funded_escrow(&clock, ctx);

        // Advance past min lock
        clock::set_for_testing(&mut clock, 1000 + 3_600_001);

        escrow::release(&mut e, 3000, &clock, ctx);

        assert!(escrow::balance_value(&e) == 7000);
        assert!(escrow::released_amount(&e) == 3000);
        assert!(escrow::state(&e) == escrow::state_partially_released());

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========== 3. test_release_full ==========

    #[test]
    fun test_release_full() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let mut e = setup_funded_escrow(&clock, ctx);
        clock::set_for_testing(&mut clock, 1000 + 3_600_001);

        escrow::release(&mut e, 10000, &clock, ctx);

        assert!(escrow::balance_value(&e) == 0);
        assert!(escrow::released_amount(&e) == 10000);
        assert!(escrow::state(&e) == escrow::state_completed());

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========== 4. test_refund_unfunded ==========

    #[test]
    fun test_refund_unfunded() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let mut e = escrow::test_create_escrow(
            PAYER, PAYEE, vector[], 0, option::none(), ctx,
        );

        escrow::refund(&mut e, &clock, ctx);
        assert!(escrow::state(&e) == escrow::state_refunded());

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========== 5. test_refund_funded ==========

    #[test]
    fun test_refund_funded() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let mut e = setup_funded_escrow(&clock, ctx);

        escrow::refund(&mut e, &clock, ctx);
        assert!(escrow::state(&e) == escrow::state_refunded());
        assert!(escrow::balance_value(&e) == 0);

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========== 6. test_refund_expired ==========

    #[test]
    fun test_refund_expired() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let mut e = escrow::test_create_escrow(
            PAYER, PAYEE, vector[], 0,
            option::some(5000), // expires at 5000
            ctx,
        );
        // Fund and set to disputed so normal refund wouldn't work
        let fund = coin::mint_for_testing<SUI>(5000, ctx);
        escrow::test_fund_balance(&mut e, fund);
        escrow::test_set_state(&mut e, escrow::state_disputed());
        escrow::test_set_funded_at(&mut e, 1000);

        // Advance past expiry
        clock::set_for_testing(&mut clock, 6000);

        escrow::refund(&mut e, &clock, ctx);
        assert!(escrow::state(&e) == escrow::state_refunded());

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========== 7. test_release_before_min_lock ==========

    #[test]
    #[expected_failure(abort_code = escrow::EMinLockDuration)]
    fun test_release_before_min_lock() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let mut e = setup_funded_escrow(&clock, ctx);

        // Only advance 1ms — not enough
        clock::set_for_testing(&mut clock, 1001);

        escrow::release(&mut e, 1000, &clock, ctx);

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========== 8. test_linear_vesting ==========

    #[test]
    fun test_linear_vesting() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let mut e = setup_funded_escrow(&clock, ctx);

        // Add linear vesting: 0 cliff, 10000ms duration
        escrow::add_vesting(
            &mut e,
            vesting::linear_type(),
            0,        // cliff
            10000,    // total duration
            vector[], // no milestones
            &clock,
            ctx,
        );

        // Advance 50% of duration
        clock::set_for_testing(&mut clock, 1000 + 5000);

        escrow::release_vested(&mut e, &clock, ctx);

        // Should release ~50% = 5000
        assert!(escrow::released_amount(&e) == 5000);
        assert!(escrow::balance_value(&e) == 5000);

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========== 9. test_milestone_vesting ==========

    #[test]
    fun test_milestone_vesting() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let mut e = setup_funded_escrow(&clock, ctx);

        let milestones = vector[
            escrow::new_milestone(string::utf8(b"Phase 1"), 3000),
            escrow::new_milestone(string::utf8(b"Phase 2"), 3000),
            escrow::new_milestone(string::utf8(b"Phase 3"), 4000),
        ];

        escrow::add_vesting(
            &mut e,
            vesting::milestone_type(),
            0, 0,
            milestones,
            &clock,
            ctx,
        );

        // Complete first milestone
        escrow::complete_milestone(&mut e, 0, &clock, ctx);

        // Release vested — should get 30% = 3000
        escrow::release_vested(&mut e, &clock, ctx);

        assert!(escrow::released_amount(&e) == 3000);
        assert!(escrow::balance_value(&e) == 7000);

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========== 10. test_milestone_invalid_sum ==========

    #[test]
    #[expected_failure(abort_code = escrow::EMilestonePercentageMismatch)]
    fun test_milestone_invalid_sum() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let mut e = setup_funded_escrow(&clock, ctx);

        // Sum = 9000 != 10000
        let milestones = vector[
            escrow::new_milestone(string::utf8(b"Phase 1"), 5000),
            escrow::new_milestone(string::utf8(b"Phase 2"), 4000),
        ];

        escrow::add_vesting(
            &mut e,
            vesting::milestone_type(),
            0, 0,
            milestones,
            &clock,
            ctx,
        );

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========== 11. test_dispute_and_resolve_release ==========

    #[test]
    fun test_dispute_and_resolve_release() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let mut e = setup_funded_escrow(&clock, ctx);

        // Raise dispute (payer)
        escrow::raise_dispute(&mut e, &clock, ctx);
        assert!(escrow::state(&e) == escrow::state_disputed());

        ts::end(scenario);

        // ARB1 votes release
        let mut scenario2 = ts::begin(ARB1);
        let ctx2 = ts::ctx(&mut scenario2);
        escrow::vote_on_dispute(&mut e, arbitration::decision_release(), &clock, ctx2);
        ts::end(scenario2);

        // ARB2 votes release — threshold reached (2)
        let mut scenario3 = ts::begin(ARB2);
        let ctx3 = ts::ctx(&mut scenario3);
        escrow::vote_on_dispute(&mut e, arbitration::decision_release(), &clock, ctx3);
        ts::end(scenario3);

        assert!(escrow::state(&e) == escrow::state_completed());
        assert!(escrow::balance_value(&e) == 0);

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
    }

    // ========== 12. test_dispute_and_resolve_refund ==========

    #[test]
    fun test_dispute_and_resolve_refund() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let mut e = setup_funded_escrow(&clock, ctx);

        escrow::raise_dispute(&mut e, &clock, ctx);
        ts::end(scenario);

        // ARB1 votes refund
        let mut scenario2 = ts::begin(ARB1);
        let ctx2 = ts::ctx(&mut scenario2);
        escrow::vote_on_dispute(&mut e, arbitration::decision_refund(), &clock, ctx2);
        ts::end(scenario2);

        // ARB2 votes refund — threshold reached
        let mut scenario3 = ts::begin(ARB2);
        let ctx3 = ts::ctx(&mut scenario3);
        escrow::vote_on_dispute(&mut e, arbitration::decision_refund(), &clock, ctx3);
        ts::end(scenario3);

        assert!(escrow::state(&e) == escrow::state_refunded());
        assert!(escrow::balance_value(&e) == 0);

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
    }

    // ========== 13. test_cannot_release_during_dispute ==========

    #[test]
    #[expected_failure(abort_code = escrow::EInvalidStateTransition)]
    fun test_cannot_release_during_dispute() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let mut e = setup_funded_escrow(&clock, ctx);

        escrow::raise_dispute(&mut e, &clock, ctx);

        clock::set_for_testing(&mut clock, 1000 + 3_600_001);
        escrow::release(&mut e, 1000, &clock, ctx);

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========== 14. test_unauthorized_release ==========

    #[test]
    #[expected_failure(abort_code = escrow::ENotPayer)]
    fun test_unauthorized_release() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let mut e = setup_funded_escrow(&clock, ctx);
        ts::end(scenario);

        // Stranger tries to release
        let mut scenario2 = ts::begin(STRANGER);
        let ctx2 = ts::ctx(&mut scenario2);
        clock::set_for_testing(&mut clock, 1000 + 3_600_001);
        escrow::release(&mut e, 1000, &clock, ctx2);

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario2);
    }

    // ========== 15a. test_payee_claim_before_expiry ==========

    #[test]
    fun test_payee_claim_before_expiry() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        // Create escrow with expiry at 100_000_000 (100s in ms)
        let expiry = 100_000_000u64;
        let mut e = escrow::test_create_escrow(
            PAYER, PAYEE, vector[], 0,
            option::some(expiry),
            ctx,
        );
        let fund = coin::mint_for_testing<SUI>(10000, ctx);
        escrow::test_fund_balance(&mut e, fund);
        escrow::test_set_state(&mut e, escrow::state_funded());
        escrow::test_set_funded_at(&mut e, 1000);
        ts::end(scenario);

        // Payee claims within 24h window before expiry
        let mut scenario2 = ts::begin(PAYEE);
        let ctx2 = ts::ctx(&mut scenario2);
        // Set clock to within claim window: expiry - 12h
        clock::set_for_testing(&mut clock, expiry - 12 * 60 * 60 * 1000);

        escrow::claim_before_expiry(&mut e, &clock, ctx2);

        assert!(escrow::state(&e) == escrow::state_completed());
        assert!(escrow::balance_value(&e) == 0);
        assert!(escrow::released_amount(&e) == 10000);

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario2);
    }

    // ========== 15b. test_payer_refund_only_after_expiry ==========

    #[test]
    #[expected_failure(abort_code = escrow::EInvalidStateTransition)]
    fun test_payer_refund_only_after_expiry() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        // Create escrow with expiry
        let expiry = 100_000_000u64;
        let mut e = escrow::test_create_escrow(
            PAYER, PAYEE, vector[], 0,
            option::some(expiry),
            ctx,
        );
        let fund = coin::mint_for_testing<SUI>(10000, ctx);
        escrow::test_fund_balance(&mut e, fund);
        escrow::test_set_state(&mut e, escrow::state_funded());
        escrow::test_set_funded_at(&mut e, 1000);

        // Payer tries to refund BEFORE expiry — should fail
        clock::set_for_testing(&mut clock, expiry - 1);
        escrow::refund(&mut e, &clock, ctx);

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========== 15c. test_payee_claim_outside_window_fails ==========

    #[test]
    #[expected_failure(abort_code = escrow::ENotInClaimWindow)]
    fun test_payee_claim_outside_window_fails() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let expiry = 100_000_000u64;
        let mut e = escrow::test_create_escrow(
            PAYER, PAYEE, vector[], 0,
            option::some(expiry),
            ctx,
        );
        let fund = coin::mint_for_testing<SUI>(10000, ctx);
        escrow::test_fund_balance(&mut e, fund);
        escrow::test_set_state(&mut e, escrow::state_funded());
        escrow::test_set_funded_at(&mut e, 1000);
        ts::end(scenario);

        // Payee tries to claim too early (before the 24h window)
        let mut scenario2 = ts::begin(PAYEE);
        let ctx2 = ts::ctx(&mut scenario2);
        clock::set_for_testing(&mut clock, expiry - 25 * 60 * 60 * 1000); // 25h before expiry

        escrow::claim_before_expiry(&mut e, &clock, ctx2);

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario2);
    }

    // ========== 15. test_double_vote ==========

    #[test]
    #[expected_failure(abort_code = escrow::EAlreadyVoted)]
    fun test_double_vote() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let mut e = setup_funded_escrow(&clock, ctx);
        escrow::raise_dispute(&mut e, &clock, ctx);
        ts::end(scenario);

        // ARB1 votes once
        let mut scenario2 = ts::begin(ARB1);
        let ctx2 = ts::ctx(&mut scenario2);
        escrow::vote_on_dispute(&mut e, arbitration::decision_release(), &clock, ctx2);
        ts::end(scenario2);

        // ARB1 tries to vote again
        let mut scenario3 = ts::begin(ARB1);
        let ctx3 = ts::ctx(&mut scenario3);
        escrow::vote_on_dispute(&mut e, arbitration::decision_refund(), &clock, ctx3);

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario3);
    }

    // ========== 16. test_commit_and_reveal_vote ==========

    #[test]
    fun test_commit_and_reveal_vote() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let mut e = setup_funded_escrow(&clock, ctx);
        escrow::raise_dispute(&mut e, &clock, ctx);
        ts::end(scenario);

        // ARB1 commits hash(RELEASE || salt)
        let salt = b"my_secret_salt";
        let mut data = vector[arbitration::decision_release()];
        data.append(salt);
        let commitment = hash::keccak256(&data);

        let mut scenario2 = ts::begin(ARB1);
        let ctx2 = ts::ctx(&mut scenario2);
        escrow::commit_vote(&mut e, commitment, 5000, &clock, ctx2);
        ts::end(scenario2);

        // ARB1 reveals with correct vote + salt
        clock::set_for_testing(&mut clock, 2000);
        let mut scenario3 = ts::begin(ARB1);
        let ctx3 = ts::ctx(&mut scenario3);
        escrow::reveal_vote(&mut e, arbitration::decision_release(), salt, &clock, ctx3);
        ts::end(scenario3);

        // ARB2 votes plain to reach threshold
        let mut scenario4 = ts::begin(ARB2);
        let ctx4 = ts::ctx(&mut scenario4);
        escrow::vote_on_dispute(&mut e, arbitration::decision_release(), &clock, ctx4);
        ts::end(scenario4);

        assert!(escrow::state(&e) == escrow::state_completed());
        assert!(escrow::balance_value(&e) == 0);

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
    }

    // ========== 17. test_reveal_vote_mismatch ==========

    #[test]
    #[expected_failure(abort_code = escrow::ERevealMismatch)]
    fun test_reveal_vote_mismatch() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let mut e = setup_funded_escrow(&clock, ctx);
        escrow::raise_dispute(&mut e, &clock, ctx);
        ts::end(scenario);

        // ARB1 commits hash(RELEASE || salt)
        let salt = b"my_secret_salt";
        let mut data = vector[arbitration::decision_release()];
        data.append(salt);
        let commitment = hash::keccak256(&data);

        let mut scenario2 = ts::begin(ARB1);
        let ctx2 = ts::ctx(&mut scenario2);
        escrow::commit_vote(&mut e, commitment, 5000, &clock, ctx2);
        ts::end(scenario2);

        // ARB1 reveals with REFUND instead of RELEASE → mismatch
        clock::set_for_testing(&mut clock, 2000);
        let mut scenario3 = ts::begin(ARB1);
        let ctx3 = ts::ctx(&mut scenario3);
        escrow::reveal_vote(&mut e, arbitration::decision_refund(), salt, &clock, ctx3);

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario3);
    }

    // ========== 18. test_double_commit_fails ==========

    #[test]
    #[expected_failure(abort_code = escrow::ECommitmentExists)]
    fun test_double_commit_fails() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let mut e = setup_funded_escrow(&clock, ctx);
        escrow::raise_dispute(&mut e, &clock, ctx);
        ts::end(scenario);

        let salt = b"salt1";
        let mut data = vector[arbitration::decision_release()];
        data.append(salt);
        let commitment = hash::keccak256(&data);

        let mut scenario2 = ts::begin(ARB1);
        let ctx2 = ts::ctx(&mut scenario2);
        escrow::commit_vote(&mut e, commitment, 5000, &clock, ctx2);
        ts::end(scenario2);

        // ARB1 tries to commit again
        let mut scenario3 = ts::begin(ARB1);
        let ctx3 = ts::ctx(&mut scenario3);
        escrow::commit_vote(&mut e, commitment, 6000, &clock, ctx3);

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario3);
    }
}
