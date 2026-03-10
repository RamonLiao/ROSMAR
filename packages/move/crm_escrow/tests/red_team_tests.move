#[test_only]
module crm_escrow::red_team_tests {
    use std::string;
    use sui::test_scenario::{Self as ts};
    use sui::coin;
    use sui::sui::SUI;
    use sui::clock;
    use crm_escrow::escrow;
    use crm_escrow::vesting;
    use crm_escrow::arbitration;

    const PAYER: address = @0xA;
    const PAYEE: address = @0xB;
    const ARB1: address = @0xC;
    const ARB2: address = @0xD;
    const ARB3: address = @0xE;
    const STRANGER: address = @0xF;

    // ========== Helper ==========

    fun setup_funded_escrow(
        clock: &clock::Clock,
        ctx: &mut TxContext,
    ): escrow::Escrow<SUI> {
        let mut e = escrow::test_create_escrow<SUI>(
            PAYER, PAYEE,
            vector[ARB1, ARB2, ARB3],
            2,
            option::none(),
            ctx,
        );
        let fund = coin::mint_for_testing<SUI>(10000, ctx);
        escrow::test_fund_balance(&mut e, fund);
        escrow::test_set_state(&mut e, escrow::state_funded());
        escrow::test_set_funded_at(&mut e, clock.timestamp_ms());
        e
    }

    // ===== 1. Integer abuse — release_vested yields 0 before any time passes =====
    // Linear vesting with cliff=0, duration=10000. At start_time (elapsed=0),
    // vested amount = 0, to_release = 0, triggers assert!(to_release > 0, EOverRelease).
    #[test]
    #[expected_failure(abort_code = escrow::EOverRelease)]
    fun red_team_release_zero_amount() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let mut e = setup_funded_escrow(&clock, ctx);

        // Add linear vesting: 0 cliff, 10000ms duration
        escrow::add_vesting(
            &mut e,
            vesting::linear_type(),
            0,
            10000,
            vector[],
            &clock,
            ctx,
        );

        // Don't advance time — elapsed=0, vested=0, to_release=0 → EOverRelease
        escrow::release_vested(&mut e, &clock, ctx);

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ===== 2. Integer abuse — release amount > balance =====
    #[test]
    #[expected_failure(abort_code = escrow::EOverRelease)]
    fun red_team_release_exceeds_balance() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let mut e = setup_funded_escrow(&clock, ctx); // 10000 MIST
        clock::set_for_testing(&mut clock, 1000 + 3_600_001);

        // Try to release 20000 from 10000 balance
        escrow::release(&mut e, 20000, &clock, ctx);

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ===== 3. Milestone overflow — percentages > 10000 bp =====
    #[test]
    #[expected_failure(abort_code = escrow::EMilestonePercentageMismatch)]
    fun red_team_milestone_overflow_bp() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let mut e = setup_funded_escrow(&clock, ctx);

        // Sum = 6000 + 6000 = 12000 > 10000
        let milestones = vector[
            escrow::new_milestone(string::utf8(b"Phase 1"), 6000),
            escrow::new_milestone(string::utf8(b"Phase 2"), 6000),
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

    // ===== 4. Ordering attack — refund funded escrow with expiry (before expiry) =====
    // Funded escrow WITH expiry → payer can only refund after expiry.
    // Trying to refund before expiry should fail with EInvalidStateTransition.
    #[test]
    #[expected_failure(abort_code = escrow::EInvalidStateTransition)]
    fun red_team_refund_funded_before_expiry() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let expiry = 100_000_000u64;
        let mut e = escrow::test_create_escrow<SUI>(
            PAYER, PAYEE, vector[], 0,
            option::some(expiry),
            ctx,
        );
        let fund = coin::mint_for_testing<SUI>(10000, ctx);
        escrow::test_fund_balance(&mut e, fund);
        escrow::test_set_state(&mut e, escrow::state_funded());
        escrow::test_set_funded_at(&mut e, 1000);

        // Try refund before expiry — not expired, not unfunded, has expiry → fail
        clock::set_for_testing(&mut clock, 50_000_000);
        escrow::refund(&mut e, &clock, ctx);

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ===== 5. Double vote attempt =====
    #[test]
    #[expected_failure(abort_code = escrow::EAlreadyVoted)]
    fun red_team_double_vote() {
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

        // ARB1 tries to vote again — should fail
        let mut scenario3 = ts::begin(ARB1);
        let ctx3 = ts::ctx(&mut scenario3);
        escrow::vote_on_dispute(&mut e, arbitration::decision_refund(), &clock, ctx3);

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario3);
    }

    // ===== 6. Release before cliff (vesting) =====
    // Linear vesting with cliff=5000ms. Try release_vested at elapsed < cliff.
    // Vested = 0 (cliff not reached), to_release = 0 → EOverRelease.
    #[test]
    #[expected_failure(abort_code = escrow::EOverRelease)]
    fun red_team_release_before_cliff() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let mut e = setup_funded_escrow(&clock, ctx);

        // Linear vesting: cliff=5000ms, duration=10000ms
        escrow::add_vesting(
            &mut e,
            vesting::linear_type(),
            5000,   // cliff_ms
            10000,  // total_duration_ms
            vector[],
            &clock,
            ctx,
        );

        // Advance only 2000ms (< cliff of 5000ms)
        clock::set_for_testing(&mut clock, 1000 + 2000);
        escrow::release_vested(&mut e, &clock, ctx);

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ===== 7. Claim before expiry outside window =====
    // Payee tries to claim > 24h before expiry (outside the claim window).
    #[test]
    #[expected_failure(abort_code = escrow::ENotInClaimWindow)]
    fun red_team_claim_outside_window() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let expiry = 200_000_000u64; // ~55 hours from now
        let mut e = escrow::test_create_escrow<SUI>(
            PAYER, PAYEE, vector[], 0,
            option::some(expiry),
            ctx,
        );
        let fund = coin::mint_for_testing<SUI>(10000, ctx);
        escrow::test_fund_balance(&mut e, fund);
        escrow::test_set_state(&mut e, escrow::state_funded());
        escrow::test_set_funded_at(&mut e, 1000);
        ts::end(scenario);

        // Payee tries to claim 48h before expiry — outside the 24h window
        let mut scenario2 = ts::begin(PAYEE);
        let ctx2 = ts::ctx(&mut scenario2);
        clock::set_for_testing(&mut clock, expiry - 48 * 60 * 60 * 1000);

        escrow::claim_before_expiry(&mut e, &clock, ctx2);

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario2);
    }

    // ===== 8. Non-arbitrator vote attempt =====
    #[test]
    #[expected_failure(abort_code = escrow::ENotArbitrator)]
    fun red_team_non_arbitrator_vote() {
        let mut scenario = ts::begin(PAYER);
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, 1000);

        let mut e = setup_funded_escrow(&clock, ctx);
        escrow::raise_dispute(&mut e, &clock, ctx);
        ts::end(scenario);

        // STRANGER (not in arbitrators list) tries to vote
        let mut scenario2 = ts::begin(STRANGER);
        let ctx2 = ts::ctx(&mut scenario2);
        escrow::vote_on_dispute(&mut e, arbitration::decision_release(), &clock, ctx2);

        escrow::test_destroy_escrow(e);
        clock::destroy_for_testing(clock);
        ts::end(scenario2);
    }
}
