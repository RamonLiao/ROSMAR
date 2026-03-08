#[test_only]
module crm_core::crm_core_tests {
    use std::string;
    use sui::test_scenario::{Self as ts};
    use sui::test_utils;
    use crm_core::capabilities;
    use crm_core::acl;
    use crm_core::workspace;
    use crm_core::profile;
    use crm_core::organization;
    use crm_core::relation;
    use crm_core::deal;
    use crm_core::admin_recovery;
    use crm_core::multi_sig_pause;

    const ADMIN: address = @0xA;
    const USER1: address = @0xB;
    const USER2: address = @0xC;

    // ========== Capabilities Tests ==========

    #[test]
    fun test_global_config_not_paused_by_default() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        assert!(!capabilities::is_paused(&config));
        capabilities::assert_not_paused(&config);
        test_utils::destroy(config);
        ts::end(scenario);
    }

    #[test]
    fun test_pause_and_unpause() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let mut config = capabilities::test_create_config(ctx);
        let pause_cap = capabilities::test_create_pause_cap(ctx);

        capabilities::pause(&mut config, &pause_cap, string::utf8(b"Emergency"));
        assert!(capabilities::is_paused(&config));

        capabilities::unpause(&mut config, &pause_cap);
        assert!(!capabilities::is_paused(&config));

        test_utils::destroy(config);
        test_utils::destroy(pause_cap);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = capabilities::EPaused)]
    fun test_assert_not_paused_fails_when_paused() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let mut config = capabilities::test_create_config(ctx);
        let pause_cap = capabilities::test_create_pause_cap(ctx);

        capabilities::pause(&mut config, &pause_cap, string::utf8(b"Test"));
        capabilities::assert_not_paused(&config);

        test_utils::destroy(config);
        test_utils::destroy(pause_cap);
        ts::end(scenario);
    }

    #[test]
    fun test_create_admin_cap() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let workspace_id = object::id_from_address(@0x123);
        let cap = capabilities::create_admin_cap(workspace_id, ctx);
        assert!(capabilities::cap_workspace_id(&cap) == workspace_id);
        test_utils::destroy(cap);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = capabilities::ECapMismatch)]
    fun test_assert_cap_mismatch_fails() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let workspace_id = object::id_from_address(@0x123);
        let other_id = object::id_from_address(@0x456);
        let cap = capabilities::create_admin_cap(workspace_id, ctx);
        capabilities::assert_cap_matches(&cap, other_id);
        test_utils::destroy(cap);
        ts::end(scenario);
    }

    #[test]
    fun test_rate_limit_check() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let workspace_id = object::id_from_address(@0x123);
        let mut rate = capabilities::create_rate_limit(workspace_id, 5, ctx);

        capabilities::check_rate_limit(&mut rate, 1);
        capabilities::check_rate_limit(&mut rate, 1);
        capabilities::check_rate_limit(&mut rate, 1);

        test_utils::destroy(rate);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 100)]
    fun test_rate_limit_exceeded() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let workspace_id = object::id_from_address(@0x123);
        let mut rate = capabilities::create_rate_limit(workspace_id, 2, ctx);

        capabilities::check_rate_limit(&mut rate, 1);
        capabilities::check_rate_limit(&mut rate, 1);
        capabilities::check_rate_limit(&mut rate, 1); // Should fail

        test_utils::destroy(rate);
        ts::end(scenario);
    }

    #[test]
    fun test_rate_limit_reset_on_new_epoch() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let workspace_id = object::id_from_address(@0x123);
        let mut rate = capabilities::create_rate_limit(workspace_id, 2, ctx);

        capabilities::check_rate_limit(&mut rate, 1);
        capabilities::check_rate_limit(&mut rate, 1);
        // New epoch resets
        capabilities::check_rate_limit(&mut rate, 2);
        capabilities::check_rate_limit(&mut rate, 2);

        test_utils::destroy(rate);
        ts::end(scenario);
    }

    // ========== ACL Tests ==========

    #[test]
    fun test_role_levels() {
        assert!(acl::level(&acl::viewer()) == 0);
        assert!(acl::level(&acl::member()) == 1);
        assert!(acl::level(&acl::admin()) == 2);
        assert!(acl::level(&acl::owner()) == 3);
    }

    #[test]
    fun test_permission_checks() {
        let viewer = acl::viewer();
        assert!(acl::has_permission(&viewer, acl::perm_read()));
        assert!(!acl::has_permission(&viewer, acl::perm_write()));

        let member = acl::member();
        assert!(acl::has_permission(&member, acl::perm_read()));
        assert!(acl::has_permission(&member, acl::perm_write()));
        assert!(!acl::has_permission(&member, acl::perm_manage()));

        let admin = acl::admin();
        assert!(acl::has_permission(&admin, acl::perm_read()));
        assert!(acl::has_permission(&admin, acl::perm_write()));
        assert!(acl::has_permission(&admin, acl::perm_manage()));
    }

    #[test]
    #[expected_failure(abort_code = acl::EInsufficientPermission)]
    fun test_assert_permission_fails() {
        let viewer = acl::viewer();
        acl::assert_permission(&viewer, acl::perm_write());
    }

    #[test]
    fun test_custom_role() {
        let custom = acl::custom_role(5, acl::perm_read() | acl::perm_share());
        assert!(acl::level(&custom) == 5);
        assert!(acl::has_permission(&custom, acl::perm_read()));
        assert!(acl::has_permission(&custom, acl::perm_share()));
        assert!(!acl::has_permission(&custom, acl::perm_write()));
    }

    // ========== Workspace Tests ==========

    #[test]
    fun test_workspace_creation() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test Workspace"), ctx);

        assert!(workspace::owner(&workspace) == ADMIN);
        assert!(workspace::member_count(&workspace) == 1);
        assert!(workspace::is_member(&workspace, ADMIN));

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        ts::end(scenario);
    }

    #[test]
    fun test_add_member() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (mut workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        workspace::add_member(&config, &mut workspace, &admin_cap, USER1, acl::member(), ctx);

        assert!(workspace::member_count(&workspace) == 2);
        assert!(workspace::is_member(&workspace, USER1));
        let role = workspace::get_member_role(&workspace, USER1);
        assert!(acl::level(role) == 1);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = workspace::EMemberExists)]
    fun test_add_duplicate_member_fails() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (mut workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        workspace::add_member(&config, &mut workspace, &admin_cap, USER1, acl::member(), ctx);
        workspace::add_member(&config, &mut workspace, &admin_cap, USER1, acl::admin(), ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        ts::end(scenario);
    }

    #[test]
    fun test_remove_member() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (mut workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        workspace::add_member(&config, &mut workspace, &admin_cap, USER1, acl::member(), ctx);
        workspace::remove_member(&config, &mut workspace, &admin_cap, USER1);

        assert!(workspace::member_count(&workspace) == 1);
        assert!(!workspace::is_member(&workspace, USER1));

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = workspace::ENotOwner)]
    fun test_cannot_remove_owner() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (mut workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        workspace::remove_member(&config, &mut workspace, &admin_cap, ADMIN);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        ts::end(scenario);
    }

    // ========== Profile Tests ==========

    #[test]
    fun test_profile_creation() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let profile = profile::create(
            &config, &workspace, &admin_cap,
            USER1,
            option::some(string::utf8(b"user1.sui")),
            vector[string::utf8(b"vip")],
            ctx
        );

        assert!(profile::primary_address(&profile) == USER1);
        assert!(profile::tier(&profile) == 0);
        assert!(profile::engagement_score(&profile) == 0);
        assert!(profile::version(&profile) == 0);
        assert!(!profile::is_archived(&profile));

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(profile);
        ts::end(scenario);
    }

    #[test]
    fun test_profile_update_tier_and_score() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut profile = profile::create(&config, &workspace, &admin_cap, USER1, option::none(), vector[], ctx);

        profile::update_tier_and_score(&mut profile, 3, 500, ctx);

        assert!(profile::tier(&profile) == 3);
        assert!(profile::engagement_score(&profile) == 500);
        assert!(profile::version(&profile) == 1);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(profile);
        ts::end(scenario);
    }

    #[test]
    fun test_profile_archive() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut profile = profile::create(&config, &workspace, &admin_cap, USER1, option::none(), vector[], ctx);

        profile::archive(&config, &workspace, &admin_cap, &mut profile, 0, ctx);

        assert!(profile::is_archived(&profile));
        assert!(profile::version(&profile) == 1);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(profile);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = profile::EVersionConflict)]
    fun test_profile_archive_version_conflict() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut profile = profile::create(&config, &workspace, &admin_cap, USER1, option::none(), vector[], ctx);

        profile::archive(&config, &workspace, &admin_cap, &mut profile, 99, ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(profile);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = profile::EAlreadyArchived)]
    fun test_profile_double_archive_fails() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut profile = profile::create(&config, &workspace, &admin_cap, USER1, option::none(), vector[], ctx);

        profile::archive(&config, &workspace, &admin_cap, &mut profile, 0, ctx);
        profile::archive(&config, &workspace, &admin_cap, &mut profile, 1, ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(profile);
        ts::end(scenario);
    }

    #[test]
    fun test_profile_add_wallet() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut profile = profile::create(&config, &workspace, &admin_cap, USER1, option::none(), vector[], ctx);

        profile::add_wallet(&config, &workspace, &admin_cap, &mut profile, USER2, string::utf8(b"ETH"), ctx);
        assert!(profile::version(&profile) == 1);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(profile);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = capabilities::ECapMismatch)]
    fun test_add_wallet_wrong_cap_fails() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"WS1"), ctx);
        let (workspace2, admin_cap2) = workspace::create(&config, string::utf8(b"WS2"), ctx);
        let mut profile = profile::create(&config, &workspace, &admin_cap, USER1, option::none(), vector[], ctx);

        // Should abort — cap2 belongs to workspace2, not workspace
        profile::add_wallet(&config, &workspace, &admin_cap2, &mut profile, USER2, string::utf8(b"sui"), ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(workspace2);
        test_utils::destroy(admin_cap);
        test_utils::destroy(admin_cap2);
        test_utils::destroy(profile);
        ts::end(scenario);
    }

    #[test]
    fun test_profile_set_metadata() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut profile = profile::create(&config, &workspace, &admin_cap, USER1, option::none(), vector[], ctx);

        profile::set_metadata(&config, &workspace, &admin_cap, &mut profile, 0, string::utf8(b"twitter"), string::utf8(b"@user1"), ctx);
        assert!(profile::version(&profile) == 1);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(profile);
        ts::end(scenario);
    }

    // ========== Organization Tests ==========

    #[test]
    fun test_organization_creation() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let org = organization::create(
            &config, &workspace, &admin_cap,
            string::utf8(b"Acme Corp"),
            option::some(string::utf8(b"Tech")),
            option::some(string::utf8(b"https://acme.com")),
            vector[string::utf8(b"enterprise")],
            ctx
        );

        assert!(organization::tier(&org) == 0);
        assert!(organization::version(&org) == 0);
        assert!(!organization::is_archived(&org));

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(org);
        ts::end(scenario);
    }

    #[test]
    fun test_organization_update_name() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut org = organization::create(&config, &workspace, &admin_cap, string::utf8(b"Old"), option::none(), option::none(), vector[], ctx);

        organization::update_name(&config, &workspace, &admin_cap, &mut org, 0, string::utf8(b"New"), ctx);
        assert!(organization::version(&org) == 1);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(org);
        ts::end(scenario);
    }

    #[test]
    fun test_organization_archive() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut org = organization::create(&config, &workspace, &admin_cap, string::utf8(b"Test Org"), option::none(), option::none(), vector[], ctx);

        organization::archive(&config, &workspace, &admin_cap, &mut org, 0, ctx);
        assert!(organization::is_archived(&org));

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(org);
        ts::end(scenario);
    }

    // ========== Relation Tests ==========

    #[test]
    fun test_relation_creation() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let profile_id = object::id_from_address(@0x111);
        let org_id = object::id_from_address(@0x222);

        let rel = relation::create(
            &config, &workspace, &admin_cap,
            profile_id, org_id,
            relation::type_member_of(),
            option::some(string::utf8(b"CEO")),
            ctx
        );

        assert!(relation::profile_id(&rel) == profile_id);
        assert!(relation::organization_id(&rel) == org_id);
        assert!(relation::relation_type(&rel) == relation::type_member_of());
        assert!(relation::version(&rel) == 0);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(rel);
        ts::end(scenario);
    }

    #[test]
    fun test_relation_update_type() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let mut rel = relation::create(&config, &workspace, &admin_cap, object::id_from_address(@0x111), object::id_from_address(@0x222), relation::type_member_of(), option::none(), ctx);

        relation::update_type(&config, &workspace, &admin_cap, &mut rel, 0, relation::type_partner(), option::some(string::utf8(b"Strategic")), ctx);
        assert!(relation::relation_type(&rel) == relation::type_partner());
        assert!(relation::version(&rel) == 1);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(rel);
        ts::end(scenario);
    }

    #[test]
    fun test_relation_archive() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let mut rel = relation::create(&config, &workspace, &admin_cap, object::id_from_address(@0x111), object::id_from_address(@0x222), relation::type_member_of(), option::none(), ctx);

        relation::archive(&config, &workspace, &admin_cap, &mut rel, 0, ctx);
        assert!(relation::is_archived(&rel));

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(rel);
        ts::end(scenario);
    }

    // ========== Deal Tests ==========

    #[test]
    fun test_deal_creation() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let profile_id = object::id_from_address(@0x111);

        let d = deal::create_deal(
            &config, &workspace, &admin_cap,
            profile_id,
            string::utf8(b"Big Deal"),
            5_000_000_000, // $5000.00
            deal::stage_qualified(),
            ctx
        );

        assert!(deal::deal_profile_id(&d) == profile_id);
        assert!(deal::deal_amount_usd(&d) == 5_000_000_000);
        assert!(deal::deal_stage(&d) == deal::stage_qualified());
        assert!(deal::deal_version(&d) == 0);
        assert!(!deal::deal_is_archived(&d));

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(d);
        ts::end(scenario);
    }

    #[test]
    fun test_deal_update() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let profile_id = object::id_from_address(@0x111);
        let mut d = deal::create_deal(&config, &workspace, &admin_cap, profile_id, string::utf8(b"Old Title"), 1_000_000, deal::stage_lead(), ctx);

        deal::update_deal(&config, &workspace, &admin_cap, &mut d, 0, string::utf8(b"New Title"), 2_000_000, deal::stage_qualified(), ctx);

        assert!(deal::deal_version(&d) == 1);
        assert!(deal::deal_amount_usd(&d) == 2_000_000);
        assert!(deal::deal_stage(&d) == deal::stage_qualified());

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

        let profile_id = object::id_from_address(@0x111);
        let mut d = deal::create_deal(&config, &workspace, &admin_cap, profile_id, string::utf8(b"Deal"), 1_000_000, deal::stage_lead(), ctx);

        deal::archive_deal(&config, &workspace, &admin_cap, &mut d, 0, ctx);

        assert!(deal::deal_is_archived(&d));
        assert!(deal::deal_version(&d) == 1);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(d);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = deal::EVersionConflict)]
    fun test_deal_version_conflict() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let profile_id = object::id_from_address(@0x111);
        let mut d = deal::create_deal(&config, &workspace, &admin_cap, profile_id, string::utf8(b"Deal"), 1_000_000, deal::stage_lead(), ctx);

        deal::update_deal(&config, &workspace, &admin_cap, &mut d, 99, string::utf8(b"New"), 2_000_000, deal::stage_won(), ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(d);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = deal::EInvalidStage)]
    fun test_deal_invalid_stage() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let profile_id = object::id_from_address(@0x111);
        let d = deal::create_deal(&config, &workspace, &admin_cap, profile_id, string::utf8(b"Deal"), 1_000_000, 99, ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(d);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = deal::EAlreadyArchived)]
    fun test_deal_double_archive_fails() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let profile_id = object::id_from_address(@0x111);
        let mut d = deal::create_deal(&config, &workspace, &admin_cap, profile_id, string::utf8(b"Deal"), 1_000_000, deal::stage_lead(), ctx);

        deal::archive_deal(&config, &workspace, &admin_cap, &mut d, 0, ctx);
        deal::archive_deal(&config, &workspace, &admin_cap, &mut d, 1, ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(d);
        ts::end(scenario);
    }

    // ========== Deal Stage Transition Tests (M2) ==========

    #[test]
    fun test_deal_valid_stage_transition() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let profile_id = object::id_from_address(@0x111);
        let mut d = deal::create_deal(&config, &workspace, &admin_cap, profile_id, string::utf8(b"Deal"), 1_000_000, deal::stage_lead(), ctx);

        // LEAD → QUALIFIED (forward +1, valid)
        deal::update_deal(&config, &workspace, &admin_cap, &mut d, 0, string::utf8(b"Deal"), 1_000_000, deal::stage_qualified(), ctx);
        assert!(deal::deal_stage(&d) == deal::stage_qualified());

        // QUALIFIED → PROPOSAL (forward +1, valid)
        deal::update_deal(&config, &workspace, &admin_cap, &mut d, 1, string::utf8(b"Deal"), 1_000_000, deal::stage_proposal(), ctx);
        assert!(deal::deal_stage(&d) == deal::stage_proposal());

        // PROPOSAL → NEGOTIATION (forward +1, valid)
        deal::update_deal(&config, &workspace, &admin_cap, &mut d, 2, string::utf8(b"Deal"), 1_000_000, deal::stage_negotiation(), ctx);
        assert!(deal::deal_stage(&d) == deal::stage_negotiation());

        // NEGOTIATION → WON (forward +1, valid)
        deal::update_deal(&config, &workspace, &admin_cap, &mut d, 3, string::utf8(b"Deal"), 1_000_000, deal::stage_won(), ctx);
        assert!(deal::deal_stage(&d) == deal::stage_won());

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(d);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = deal::EInvalidStageTransition)]
    fun test_deal_invalid_stage_skip() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let profile_id = object::id_from_address(@0x111);
        let mut d = deal::create_deal(&config, &workspace, &admin_cap, profile_id, string::utf8(b"Deal"), 1_000_000, deal::stage_lead(), ctx);

        // LEAD → WON: skip stages, should abort
        deal::update_deal(&config, &workspace, &admin_cap, &mut d, 0, string::utf8(b"Deal"), 1_000_000, deal::stage_won(), ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(d);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = deal::EInvalidStageTransition)]
    fun test_deal_terminal_stage_no_transition() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let profile_id = object::id_from_address(@0x111);
        let mut d = deal::create_deal(&config, &workspace, &admin_cap, profile_id, string::utf8(b"Deal"), 1_000_000, deal::stage_lead(), ctx);

        // Walk to WON via full pipeline
        deal::update_deal(&config, &workspace, &admin_cap, &mut d, 0, string::utf8(b"Deal"), 1_000_000, deal::stage_qualified(), ctx);
        deal::update_deal(&config, &workspace, &admin_cap, &mut d, 1, string::utf8(b"Deal"), 1_000_000, deal::stage_proposal(), ctx);
        deal::update_deal(&config, &workspace, &admin_cap, &mut d, 2, string::utf8(b"Deal"), 1_000_000, deal::stage_negotiation(), ctx);
        deal::update_deal(&config, &workspace, &admin_cap, &mut d, 3, string::utf8(b"Deal"), 1_000_000, deal::stage_won(), ctx);

        // WON → LEAD: terminal, should abort
        deal::update_deal(&config, &workspace, &admin_cap, &mut d, 4, string::utf8(b"Deal"), 1_000_000, deal::stage_lead(), ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(d);
        ts::end(scenario);
    }

    #[test]
    fun test_deal_can_lose_from_any_stage() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let profile_id = object::id_from_address(@0x111);
        let mut d = deal::create_deal(&config, &workspace, &admin_cap, profile_id, string::utf8(b"Deal"), 1_000_000, deal::stage_lead(), ctx);

        // LEAD → LOST: can abandon from any stage
        deal::update_deal(&config, &workspace, &admin_cap, &mut d, 0, string::utf8(b"Deal"), 1_000_000, deal::stage_lost(), ctx);
        assert!(deal::deal_stage(&d) == deal::stage_lost());

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(d);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = deal::EInvalidStageTransition)]
    fun test_deal_backward_transition_fails() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let profile_id = object::id_from_address(@0x111);
        let mut d = deal::create_deal(&config, &workspace, &admin_cap, profile_id, string::utf8(b"Deal"), 1_000_000, deal::stage_lead(), ctx);

        // LEAD → QUALIFIED
        deal::update_deal(&config, &workspace, &admin_cap, &mut d, 0, string::utf8(b"Deal"), 1_000_000, deal::stage_qualified(), ctx);
        // QUALIFIED → LEAD: backward, should abort
        deal::update_deal(&config, &workspace, &admin_cap, &mut d, 1, string::utf8(b"Deal"), 1_000_000, deal::stage_lead(), ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(d);
        ts::end(scenario);
    }

    // ========== Admin Cap Recovery Tests (M3) ==========

    #[test]
    fun test_recover_admin_cap_by_owner() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"WS"), ctx);

        // Owner recovers a new cap
        let recovered_cap = admin_recovery::recover_admin_cap(&config, &workspace, ctx);
        assert!(capabilities::cap_workspace_id(&recovered_cap) == workspace::id(&workspace));

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(recovered_cap);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin_recovery::ENotWorkspaceOwner)]
    fun test_recover_admin_cap_non_owner_fails() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"WS"), ctx);

        // Switch to non-owner
        ts::next_tx(&mut scenario, USER1);
        let ctx2 = ts::ctx(&mut scenario);

        // Should abort — USER1 is not owner
        let bad_cap = admin_recovery::recover_admin_cap(&config, &workspace, ctx2);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(bad_cap);
        ts::end(scenario);
    }

    // ========== Multi-sig Pause Tests (M4) ==========

    #[test]
    fun test_create_pause_proposal() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);

        let voters = vector[ADMIN, USER1, USER2];
        let proposal = multi_sig_pause::create_proposal(
            multi_sig_pause::action_pause(),
            string::utf8(b"Security incident"),
            voters,
            2, // threshold
            ctx,
        );

        assert!(!multi_sig_pause::is_resolved(&proposal));
        assert!(multi_sig_pause::signer_count(&proposal) == 0);

        multi_sig_pause::test_destroy_proposal(proposal);
        ts::end(scenario);
    }

    #[test]
    fun test_pause_threshold_reached() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let mut config = capabilities::test_create_config(ctx);

        let voters = vector[ADMIN, USER1, USER2];
        let mut proposal = multi_sig_pause::create_proposal(
            multi_sig_pause::action_pause(),
            string::utf8(b"Emergency"),
            voters,
            2,
            ctx,
        );

        // First vote (ADMIN)
        multi_sig_pause::vote(&mut proposal, &mut config, ctx);
        assert!(!capabilities::is_paused(&config));

        // Second vote (USER1) — threshold reached
        ts::next_tx(&mut scenario, USER1);
        let ctx2 = ts::ctx(&mut scenario);
        multi_sig_pause::vote(&mut proposal, &mut config, ctx2);

        assert!(capabilities::is_paused(&config));
        assert!(multi_sig_pause::is_resolved(&proposal));

        multi_sig_pause::test_destroy_proposal(proposal);
        test_utils::destroy(config);
        ts::end(scenario);
    }

    #[test]
    fun test_single_vote_insufficient() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let mut config = capabilities::test_create_config(ctx);

        let voters = vector[ADMIN, USER1, USER2];
        let mut proposal = multi_sig_pause::create_proposal(
            multi_sig_pause::action_pause(),
            string::utf8(b"Test"),
            voters,
            3, // need all 3
            ctx,
        );

        multi_sig_pause::vote(&mut proposal, &mut config, ctx);
        assert!(!capabilities::is_paused(&config));
        assert!(!multi_sig_pause::is_resolved(&proposal));

        multi_sig_pause::test_destroy_proposal(proposal);
        test_utils::destroy(config);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = multi_sig_pause::EAlreadyVoted)]
    fun test_double_vote_fails() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let mut config = capabilities::test_create_config(ctx);

        let voters = vector[ADMIN, USER1];
        let mut proposal = multi_sig_pause::create_proposal(
            multi_sig_pause::action_pause(),
            string::utf8(b"Test"),
            voters,
            2,
            ctx,
        );

        multi_sig_pause::vote(&mut proposal, &mut config, ctx);
        multi_sig_pause::vote(&mut proposal, &mut config, ctx); // double vote

        multi_sig_pause::test_destroy_proposal(proposal);
        test_utils::destroy(config);
        ts::end(scenario);
    }

    #[test]
    fun test_recovered_cap_works_normally() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, _original_cap) = workspace::create(&config, string::utf8(b"WS"), ctx);

        // Recover a new cap
        let recovered_cap = admin_recovery::recover_admin_cap(&config, &workspace, ctx);

        // Use recovered cap to create a profile — should succeed
        let p = profile::create(
            &config, &workspace, &recovered_cap,
            USER1, option::none(), vector[], ctx,
        );

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(_original_cap);
        test_utils::destroy(recovered_cap);
        test_utils::destroy(p);
        ts::end(scenario);
    }
}
