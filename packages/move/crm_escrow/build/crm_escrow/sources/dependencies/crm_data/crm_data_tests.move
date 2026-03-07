#[test_only]
module crm_data::crm_data_tests {
    use std::string;
    use sui::test_scenario::{Self as ts};
    use sui::test_utils;
    use crm_core::capabilities;
    use crm_core::acl;
    use crm_core::workspace;
    use crm_data::segment;
    use crm_data::campaign;
    use crm_data::deal;
    use crm_data::ticket;

    const ADMIN: address = @0xA;

    // ========== Segment Tests ==========

    #[test]
    fun test_segment_creation() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let seg = segment::create(&config, &workspace, &admin_cap, string::utf8(b"VIP Users"), b"hash123", true, ctx);

        assert!(segment::member_count(&seg) == 0);
        assert!(segment::is_dynamic(&seg));
        assert!(segment::version(&seg) == 0);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(seg);
        ts::end(scenario);
    }

    #[test]
    fun test_segment_update_rule_hash() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut seg = segment::create(&config, &workspace, &admin_cap, string::utf8(b"Seg"), b"old", false, ctx);

        segment::update_rule_hash(&config, &workspace, &admin_cap, &mut seg, 0, b"new", ctx);
        assert!(segment::version(&seg) == 1);
        assert!(*segment::rule_hash(&seg) == b"new");

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(seg);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = segment::EVersionConflict)]
    fun test_segment_version_conflict() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut seg = segment::create(&config, &workspace, &admin_cap, string::utf8(b"Seg"), b"hash", false, ctx);

        segment::update_rule_hash(&config, &workspace, &admin_cap, &mut seg, 99, b"new", ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(seg);
        ts::end(scenario);
    }

    #[test]
    fun test_segment_update_member_count() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut seg = segment::create(&config, &workspace, &admin_cap, string::utf8(b"Seg"), b"hash", true, ctx);

        segment::update_member_count(&config, &workspace, &admin_cap, &mut seg, 42, ctx);
        assert!(segment::member_count(&seg) == 42);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(seg);
        ts::end(scenario);
    }

    // ========== Campaign Tests ==========

    #[test]
    fun test_campaign_creation() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let segment_id = object::id_from_address(@0x111);

        let camp = campaign::create(&config, &workspace, &admin_cap, string::utf8(b"Summer Sale"), segment_id, option::none(), ctx);

        assert!(campaign::status(&camp) == campaign::status_draft());
        assert!(campaign::version(&camp) == 0);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(camp);
        ts::end(scenario);
    }

    #[test]
    fun test_campaign_lifecycle_draft_active_paused_active_completed() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let segment_id = object::id_from_address(@0x111);
        let mut camp = campaign::create(&config, &workspace, &admin_cap, string::utf8(b"Camp"), segment_id, option::none(), ctx);

        // draft → active
        campaign::launch(&config, &workspace, &admin_cap, &mut camp, ctx);
        assert!(campaign::status(&camp) == campaign::status_active());

        // active → paused
        campaign::pause(&config, &workspace, &admin_cap, &mut camp, ctx);
        assert!(campaign::status(&camp) == campaign::status_paused());

        // paused → active
        campaign::launch(&config, &workspace, &admin_cap, &mut camp, ctx);
        assert!(campaign::status(&camp) == campaign::status_active());

        // active → completed
        campaign::complete(&config, &workspace, &admin_cap, &mut camp, ctx);
        assert!(campaign::status(&camp) == campaign::status_completed());

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(camp);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = campaign::EInvalidTransition)]
    fun test_campaign_cannot_pause_draft() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut camp = campaign::create(&config, &workspace, &admin_cap, string::utf8(b"Camp"), object::id_from_address(@0x111), option::none(), ctx);

        campaign::pause(&config, &workspace, &admin_cap, &mut camp, ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(camp);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = campaign::EInvalidTransition)]
    fun test_campaign_cannot_complete_draft() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut camp = campaign::create(&config, &workspace, &admin_cap, string::utf8(b"Camp"), object::id_from_address(@0x111), option::none(), ctx);

        campaign::complete(&config, &workspace, &admin_cap, &mut camp, ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(camp);
        ts::end(scenario);
    }

    // ========== Deal Tests ==========

    #[test]
    fun test_deal_creation() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let d = deal::create(&config, &workspace, &admin_cap, object::id_from_address(@0x111), option::none(), string::utf8(b"Big Deal"), 1000000, string::utf8(b"SUI"), option::none(), ctx);

        assert!(deal::stage(&d) == deal::stage_new());
        assert!(deal::value(&d) == 1000000);
        assert!(deal::version(&d) == 0);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(d);
        ts::end(scenario);
    }

    #[test]
    fun test_deal_stage_progression() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut d = deal::create(&config, &workspace, &admin_cap, object::id_from_address(@0x111), option::none(), string::utf8(b"Deal"), 500, string::utf8(b"SUI"), option::none(), ctx);

        // new → qualified
        deal::advance_stage(&config, &workspace, &admin_cap, &mut d, 0, deal::stage_qualified(), ctx);
        assert!(deal::stage(&d) == deal::stage_qualified());

        // qualified → proposal
        deal::advance_stage(&config, &workspace, &admin_cap, &mut d, 1, deal::stage_proposal(), ctx);
        assert!(deal::stage(&d) == deal::stage_proposal());

        // proposal → won
        deal::advance_stage(&config, &workspace, &admin_cap, &mut d, 2, deal::stage_won(), ctx);
        assert!(deal::stage(&d) == deal::stage_won());

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(d);
        ts::end(scenario);
    }

    #[test]
    fun test_deal_skip_to_lost() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut d = deal::create(&config, &workspace, &admin_cap, object::id_from_address(@0x111), option::none(), string::utf8(b"Deal"), 500, string::utf8(b"SUI"), option::none(), ctx);

        // new → lost (skip allowed)
        deal::advance_stage(&config, &workspace, &admin_cap, &mut d, 0, deal::stage_lost(), ctx);
        assert!(deal::stage(&d) == deal::stage_lost());

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(d);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = deal::EInvalidTransition)]
    fun test_deal_invalid_transition_won_to_qualified() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut d = deal::create(&config, &workspace, &admin_cap, object::id_from_address(@0x111), option::none(), string::utf8(b"Deal"), 500, string::utf8(b"SUI"), option::none(), ctx);

        deal::advance_stage(&config, &workspace, &admin_cap, &mut d, 0, deal::stage_won(), ctx);
        // Won is terminal — can't go back
        deal::advance_stage(&config, &workspace, &admin_cap, &mut d, 1, deal::stage_qualified(), ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(d);
        ts::end(scenario);
    }

    #[test]
    fun test_deal_archive() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut d = deal::create(&config, &workspace, &admin_cap, object::id_from_address(@0x111), option::none(), string::utf8(b"Deal"), 500, string::utf8(b"SUI"), option::none(), ctx);

        deal::archive(&config, &workspace, &admin_cap, &mut d, 0, ctx);
        assert!(deal::is_archived(&d));

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(d);
        ts::end(scenario);
    }

    // ========== Ticket Tests ==========

    #[test]
    fun test_ticket_creation() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let t = ticket::create(&config, &workspace, &admin_cap, object::id_from_address(@0x111), string::utf8(b"Bug report"), ticket::priority_high(), option::none(), option::none(), ctx);

        assert!(ticket::status(&t) == ticket::status_open());
        assert!(ticket::priority(&t) == ticket::priority_high());
        assert!(ticket::version(&t) == 0);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(t);
        ts::end(scenario);
    }

    #[test]
    fun test_ticket_status_progression() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut t = ticket::create(&config, &workspace, &admin_cap, object::id_from_address(@0x111), string::utf8(b"Bug"), ticket::priority_medium(), option::none(), option::none(), ctx);

        // open → in_progress
        ticket::transition_status(&config, &workspace, &admin_cap, &mut t, 0, ticket::status_in_progress(), ctx);
        assert!(ticket::status(&t) == ticket::status_in_progress());

        // in_progress → waiting
        ticket::transition_status(&config, &workspace, &admin_cap, &mut t, 1, ticket::status_waiting(), ctx);
        assert!(ticket::status(&t) == ticket::status_waiting());

        // waiting → in_progress
        ticket::transition_status(&config, &workspace, &admin_cap, &mut t, 2, ticket::status_in_progress(), ctx);

        // in_progress → resolved
        ticket::transition_status(&config, &workspace, &admin_cap, &mut t, 3, ticket::status_resolved(), ctx);
        assert!(ticket::status(&t) == ticket::status_resolved());

        // resolved → closed
        ticket::transition_status(&config, &workspace, &admin_cap, &mut t, 4, ticket::status_closed(), ctx);
        assert!(ticket::status(&t) == ticket::status_closed());

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(t);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = ticket::EInvalidTransition)]
    fun test_ticket_invalid_transition_open_to_resolved() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut t = ticket::create(&config, &workspace, &admin_cap, object::id_from_address(@0x111), string::utf8(b"Bug"), ticket::priority_low(), option::none(), option::none(), ctx);

        // Can't jump from open directly to resolved
        ticket::transition_status(&config, &workspace, &admin_cap, &mut t, 0, ticket::status_resolved(), ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(t);
        ts::end(scenario);
    }

    #[test]
    fun test_ticket_reopen_from_resolved() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut t = ticket::create(&config, &workspace, &admin_cap, object::id_from_address(@0x111), string::utf8(b"Bug"), ticket::priority_low(), option::none(), option::none(), ctx);

        ticket::transition_status(&config, &workspace, &admin_cap, &mut t, 0, ticket::status_in_progress(), ctx);
        ticket::transition_status(&config, &workspace, &admin_cap, &mut t, 1, ticket::status_resolved(), ctx);
        // Reopen from resolved
        ticket::transition_status(&config, &workspace, &admin_cap, &mut t, 2, ticket::status_in_progress(), ctx);
        assert!(ticket::status(&t) == ticket::status_in_progress());

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(t);
        ts::end(scenario);
    }

    #[test]
    fun test_ticket_assign() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut t = ticket::create(&config, &workspace, &admin_cap, object::id_from_address(@0x111), string::utf8(b"Bug"), ticket::priority_low(), option::none(), option::none(), ctx);

        ticket::assign(&config, &workspace, &admin_cap, &mut t, @0xB, ctx);
        assert!(ticket::version(&t) == 1);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(t);
        ts::end(scenario);
    }
}
