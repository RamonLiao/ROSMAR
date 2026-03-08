#[test_only]
module crm_data::red_team_tests {
    use std::string;
    use sui::test_scenario::{Self as ts};
    use sui::test_utils;
    use crm_core::capabilities;
    use crm_core::workspace;
    use crm_data::campaign;
    use crm_data::ticket;
    use crm_data::segment;
    use crm_data::deal;

    const ADMIN: address = @0xA;

    // ========== RT-1: Invalid campaign state transition (DRAFT → COMPLETED) ==========
    // complete() requires ACTIVE status. DRAFT → COMPLETED is illegal.
    // Should fail with EInvalidTransition(801).

    #[test]
    #[expected_failure(abort_code = campaign::EInvalidTransition)]
    fun test_campaign_draft_to_completed() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let mut camp = campaign::create(
            &config, &workspace, &admin_cap,
            string::utf8(b"Camp"),
            object::id_from_address(@0x111),
            option::none(),
            ctx,
        );

        // Skip ACTIVE, jump straight to COMPLETED — should abort
        campaign::complete(&config, &workspace, &admin_cap, &mut camp, ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(camp);
        ts::end(scenario);
    }

    // ========== RT-2: Ticket re-close after CLOSED ==========
    // Once CLOSED, no further transitions are valid.
    // Should fail with EInvalidTransition(1002).

    #[test]
    #[expected_failure(abort_code = ticket::EInvalidTransition)]
    fun test_ticket_reclose_after_closed() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let mut t = ticket::create(
            &config, &workspace, &admin_cap,
            object::id_from_address(@0x111),
            string::utf8(b"Bug"),
            ticket::priority_medium(),
            option::none(),
            option::none(),
            ctx,
        );

        // Walk to CLOSED: open → in_progress → resolved → closed
        ticket::transition_status(&config, &workspace, &admin_cap, &mut t, 0, ticket::status_in_progress(), ctx);
        ticket::transition_status(&config, &workspace, &admin_cap, &mut t, 1, ticket::status_resolved(), ctx);
        ticket::transition_status(&config, &workspace, &admin_cap, &mut t, 2, ticket::status_closed(), ctx);

        // Try to transition again from CLOSED — should abort
        ticket::transition_status(&config, &workspace, &admin_cap, &mut t, 3, ticket::status_in_progress(), ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(t);
        ts::end(scenario);
    }

    // ========== RT-3: Segment cross-workspace update ==========
    // Create segment in WS-A, try to update_rule_hash using WS-B's cap + workspace.
    // Should fail with EWorkspaceMismatch(701).

    #[test]
    #[expected_failure(abort_code = segment::EWorkspaceMismatch)]
    fun test_segment_cross_workspace_update() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (ws_a, cap_a) = workspace::create(&config, string::utf8(b"WS-A"), ctx);
        let (ws_b, cap_b) = workspace::create(&config, string::utf8(b"WS-B"), ctx);

        // Create segment in WS-A
        let mut seg = segment::create(
            &config, &ws_a, &cap_a,
            string::utf8(b"VIP"),
            b"hash_a",
            true,
            ctx,
        );

        // Attacker uses WS-B cap + workspace to update WS-A's segment
        segment::update_rule_hash(&config, &ws_b, &cap_b, &mut seg, 0, b"pwned", ctx);

        test_utils::destroy(config);
        test_utils::destroy(ws_a);
        test_utils::destroy(ws_b);
        test_utils::destroy(cap_a);
        test_utils::destroy(cap_b);
        test_utils::destroy(seg);
        ts::end(scenario);
    }

    // ========== RT-4: Deal archive then advance_stage ==========
    // Archive a deal, then try to advance_stage. Should fail with EAlreadyArchived(903).

    #[test]
    #[expected_failure(abort_code = deal::EAlreadyArchived)]
    fun test_deal_archive_then_advance() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let mut d = deal::create(
            &config, &workspace, &admin_cap,
            object::id_from_address(@0x111),
            option::none(),
            string::utf8(b"Deal"),
            1000,
            string::utf8(b"SUI"),
            option::none(),
            ctx,
        );

        // Archive at version 0
        deal::archive(&config, &workspace, &admin_cap, &mut d, 0, ctx);

        // Try to advance stage on archived deal (version is now 1)
        deal::advance_stage(
            &config, &workspace, &admin_cap, &mut d,
            1, // correct version after archive
            deal::stage_qualified(),
            ctx,
        );

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(d);
        ts::end(scenario);
    }
}
