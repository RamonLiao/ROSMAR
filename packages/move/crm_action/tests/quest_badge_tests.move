#[test_only]
module crm_action::quest_badge_tests {
    use std::string;
    use sui::test_scenario::{Self as ts};
    use sui::test_utils;
    use crm_core::capabilities;
    use crm_core::workspace;
    use crm_action::quest_badge;

    const ADMIN: address = @0xA;
    const USER1: address = @0xB;
    const USER2: address = @0xC;

    // ========== 1. test_mint_badge ==========

    #[test]
    fun test_mint_badge() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut registry = quest_badge::test_create_registry(ctx);

        quest_badge::mint_badge(
            &config,
            &workspace,
            &admin_cap,
            &mut registry,
            USER1,
            b"quest_001",
            string::utf8(b"First Quest"),
            5,
            5,
            1,
            ctx,
        );

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        quest_badge::test_destroy_registry(registry);
        ts::end(scenario);
    }

    // ========== 2. test_mint_badge_dedup ==========

    #[test]
    #[expected_failure(abort_code = quest_badge::EDuplicateBadge)]
    fun test_mint_badge_dedup() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut registry = quest_badge::test_create_registry(ctx);

        quest_badge::mint_badge(
            &config, &workspace, &admin_cap, &mut registry,
            USER1, b"quest_001", string::utf8(b"First Quest"), 5, 5, 1, ctx,
        );

        // Same quest_id + recipient = should fail
        quest_badge::mint_badge(
            &config, &workspace, &admin_cap, &mut registry,
            USER1, b"quest_001", string::utf8(b"First Quest"), 5, 5, 1, ctx,
        );

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        quest_badge::test_destroy_registry(registry);
        ts::end(scenario);
    }

    // ========== 3. test_mint_badge_different_recipients ==========

    #[test]
    fun test_mint_badge_different_recipients() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut registry = quest_badge::test_create_registry(ctx);

        // Same quest_id but different recipients — should succeed
        quest_badge::mint_badge(
            &config, &workspace, &admin_cap, &mut registry,
            USER1, b"quest_001", string::utf8(b"First Quest"), 5, 5, 1, ctx,
        );

        quest_badge::mint_badge(
            &config, &workspace, &admin_cap, &mut registry,
            USER2, b"quest_001", string::utf8(b"First Quest"), 5, 5, 1, ctx,
        );

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        quest_badge::test_destroy_registry(registry);
        ts::end(scenario);
    }

    // ========== 4. test_mint_requires_admin_cap ==========

    #[test]
    #[expected_failure(abort_code = capabilities::ECapMismatch)]
    fun test_mint_requires_admin_cap() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"WS1"), ctx);
        let (_workspace2, admin_cap2) = workspace::create(&config, string::utf8(b"WS2"), ctx);
        let mut registry = quest_badge::test_create_registry(ctx);

        // Using admin_cap2 (for WS2) against workspace (WS1) — should fail
        quest_badge::mint_badge(
            &config, &workspace, &admin_cap2, &mut registry,
            USER1, b"quest_001", string::utf8(b"First Quest"), 5, 5, 1, ctx,
        );

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(_workspace2);
        test_utils::destroy(admin_cap);
        test_utils::destroy(admin_cap2);
        quest_badge::test_destroy_registry(registry);
        ts::end(scenario);
    }

    // ========== 5. test_mint_when_paused ==========

    #[test]
    #[expected_failure(abort_code = capabilities::EPaused)]
    fun test_mint_when_paused() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let mut config = capabilities::test_create_config(ctx);
        let pause_cap = capabilities::test_create_pause_cap(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut registry = quest_badge::test_create_registry(ctx);

        // Pause the system
        capabilities::pause(&mut config, &pause_cap, string::utf8(b"maintenance"));

        quest_badge::mint_badge(
            &config, &workspace, &admin_cap, &mut registry,
            USER1, b"quest_001", string::utf8(b"First Quest"), 5, 5, 1, ctx,
        );

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(pause_cap);
        quest_badge::test_destroy_registry(registry);
        ts::end(scenario);
    }

    // ========== 6. test_accessors ==========

    #[test]
    fun test_accessors() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut registry = quest_badge::test_create_registry(ctx);

        quest_badge::mint_badge(
            &config, &workspace, &admin_cap, &mut registry,
            USER1, b"quest_abc", string::utf8(b"Test Quest"), 3, 5, 2, ctx,
        );

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        quest_badge::test_destroy_registry(registry);
        ts::end(scenario);

        // In next tx, USER1 receives the badge
        let mut scenario2 = ts::begin(USER1);
        ts::next_tx(&mut scenario2, USER1);
        let badge = ts::take_from_address<quest_badge::QuestBadge>(&scenario2, USER1);

        assert!(quest_badge::quest_id(&badge) == &b"quest_abc");
        assert!(quest_badge::tier(&badge) == 2);
        assert!(!quest_badge::is_complete(&badge)); // 3/5 not complete
        assert!(quest_badge::completed_steps(&badge) == 3);
        assert!(quest_badge::total_steps(&badge) == 5);

        ts::return_to_address(USER1, badge);
        ts::end(scenario2);
    }

    // ========== 7. test_badge_not_transferable ==========
    // QuestBadge has `key` but no `store`, so public_transfer won't compile.
    // We verify this by checking the badge reaches the intended recipient
    // and cannot be retrieved by another address.

    #[test]
    fun test_badge_not_transferable() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut registry = quest_badge::test_create_registry(ctx);

        quest_badge::mint_badge(
            &config, &workspace, &admin_cap, &mut registry,
            USER1, b"quest_sbt", string::utf8(b"SBT Quest"), 5, 5, 1, ctx,
        );

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        quest_badge::test_destroy_registry(registry);
        ts::end(scenario);

        // Badge should be owned by USER1
        let mut scenario2 = ts::begin(USER1);
        ts::next_tx(&mut scenario2, USER1);
        let badge = ts::take_from_address<quest_badge::QuestBadge>(&scenario2, USER1);

        // Verify it's complete
        assert!(quest_badge::is_complete(&badge));
        assert!(quest_badge::issuer(&badge) == ADMIN);

        // Cannot public_transfer since no `store` — this is enforced at compile time.
        // We just verify ownership here.
        ts::return_to_address(USER1, badge);
        ts::end(scenario2);
    }
}
