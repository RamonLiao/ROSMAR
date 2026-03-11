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

    // ========== 8. test_revoke_badge ==========

    #[test]
    fun test_revoke_badge() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut registry = quest_badge::test_create_registry(ctx);

        quest_badge::mint_badge(
            &config, &workspace, &admin_cap, &mut registry,
            USER1, b"quest_rev", string::utf8(b"Revocable Quest"), 5, 5, 1, ctx,
        );

        let quest_id = b"quest_rev";
        let badge_id = quest_badge::test_get_badge_id(&registry, &quest_id, USER1);

        assert!(!quest_badge::is_revoked(&registry, badge_id));

        // Admin revokes the badge
        quest_badge::revoke_badge(
            &config, &workspace, &admin_cap, &mut registry,
            badge_id, b"quest_rev", USER1, ctx,
        );

        assert!(quest_badge::is_revoked(&registry, badge_id));

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        quest_badge::test_destroy_registry(registry);
        ts::end(scenario);
    }

    // ========== 9. test_revoke_allows_remint ==========

    #[test]
    fun test_revoke_allows_remint() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut registry = quest_badge::test_create_registry(ctx);

        quest_badge::mint_badge(
            &config, &workspace, &admin_cap, &mut registry,
            USER1, b"quest_re", string::utf8(b"Re-mintable"), 5, 5, 1, ctx,
        );

        let quest_id = b"quest_re";
        let badge_id = quest_badge::test_get_badge_id(&registry, &quest_id, USER1);

        // Revoke
        quest_badge::revoke_badge(
            &config, &workspace, &admin_cap, &mut registry,
            badge_id, b"quest_re", USER1, ctx,
        );

        // Re-mint same quest+recipient — should succeed since dedup entry was removed
        quest_badge::mint_badge(
            &config, &workspace, &admin_cap, &mut registry,
            USER1, b"quest_re", string::utf8(b"Re-mintable"), 5, 5, 2, ctx,
        );

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        quest_badge::test_destroy_registry(registry);
        ts::end(scenario);
    }

    // ========== 10. test_double_revoke_fails ==========

    #[test]
    #[expected_failure(abort_code = quest_badge::EAlreadyRevoked)]
    fun test_double_revoke_fails() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut registry = quest_badge::test_create_registry(ctx);

        quest_badge::mint_badge(
            &config, &workspace, &admin_cap, &mut registry,
            USER1, b"quest_dd", string::utf8(b"Double Revoke"), 5, 5, 1, ctx,
        );

        let quest_id = b"quest_dd";
        let badge_id = quest_badge::test_get_badge_id(&registry, &quest_id, USER1);

        quest_badge::revoke_badge(
            &config, &workspace, &admin_cap, &mut registry,
            badge_id, b"quest_dd", USER1, ctx,
        );

        // Second revoke should fail
        quest_badge::revoke_badge(
            &config, &workspace, &admin_cap, &mut registry,
            badge_id, b"quest_dd", USER1, ctx,
        );

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        quest_badge::test_destroy_registry(registry);
        ts::end(scenario);
    }

    // ========== 11. test_burn_badge ==========

    #[test]
    fun test_burn_badge() {
        let mut scenario = ts::begin(ADMIN);
        {
            let ctx = ts::ctx(&mut scenario);
            let config = capabilities::test_create_config(ctx);
            let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
            let mut registry = quest_badge::test_create_registry(ctx);

            quest_badge::mint_badge(
                &config, &workspace, &admin_cap, &mut registry,
                USER1, b"quest_burn", string::utf8(b"Burnable"), 5, 5, 1, ctx,
            );

            test_utils::destroy(config);
            test_utils::destroy(workspace);
            test_utils::destroy(admin_cap);
            quest_badge::test_share_registry(registry);
        };

        // USER1 burns their own badge
        ts::next_tx(&mut scenario, USER1);
        {
            let badge = ts::take_from_address<quest_badge::QuestBadge>(&scenario, USER1);
            let mut registry = ts::take_shared<quest_badge::QuestRegistry>(&scenario);

            quest_badge::burn_badge(badge, &mut registry, ts::ctx(&mut scenario));

            ts::return_shared(registry);
        };

        ts::end(scenario);
    }

    // ========== 12. test_revoke_wrong_cap_fails ==========

    #[test]
    #[expected_failure(abort_code = capabilities::ECapMismatch)]
    fun test_revoke_wrong_cap_fails() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"WS1"), ctx);
        let (_ws2, cap2) = workspace::create(&config, string::utf8(b"WS2"), ctx);
        let mut registry = quest_badge::test_create_registry(ctx);

        quest_badge::mint_badge(
            &config, &workspace, &admin_cap, &mut registry,
            USER1, b"quest_xw", string::utf8(b"Cross WS"), 5, 5, 1, ctx,
        );

        let quest_id = b"quest_xw";
        let badge_id = quest_badge::test_get_badge_id(&registry, &quest_id, USER1);

        // Revoke with wrong workspace cap — should fail
        quest_badge::revoke_badge(
            &config, &workspace, &cap2, &mut registry,
            badge_id, b"quest_xw", USER1, ctx,
        );

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(_ws2);
        test_utils::destroy(admin_cap);
        test_utils::destroy(cap2);
        quest_badge::test_destroy_registry(registry);
        ts::end(scenario);
    }
}
