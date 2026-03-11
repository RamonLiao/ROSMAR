#[test_only]
module crm_vault::crm_vault_tests {
    use std::string;
    use sui::test_scenario::{Self as ts};
    use sui::test_utils;
    use crm_core::capabilities;
    use crm_core::workspace;
    use crm_vault::vault;
    use crm_vault::policy;

    const ADMIN: address = @0xA;
    const USER1: address = @0xB;
    const USER2: address = @0xC;

    // ========== Vault Tests ==========

    #[test]
    fun test_vault_creation() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let v = vault::create(
            &config, &workspace, &admin_cap,
            object::id_from_address(@0x111),
            vault::type_note(),
            string::utf8(b"Meeting Notes"),
            option::some(string::utf8(b"text/plain")),
            1024,
            ctx
        );

        assert!(vault::vault_type(&v) == vault::type_note());
        assert!(vault::version(&v) == 0);
        assert!(!vault::is_archived(&v));

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(v);
        ts::end(scenario);
    }

    #[test]
    fun test_vault_set_blob() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut v = vault::create(&config, &workspace, &admin_cap, object::id_from_address(@0x111), vault::type_file(), string::utf8(b"Doc"), option::none(), 2048, ctx);

        let blob_id = object::id_from_address(@0x333);
        let policy_id = object::id_from_address(@0x444);
        vault::set_blob(&config, &workspace, &admin_cap, &mut v, 0, blob_id, policy_id, ctx);
        assert!(vault::version(&v) == 1);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(v);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = vault::EVersionConflict)]
    fun test_vault_set_blob_version_conflict() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut v = vault::create(&config, &workspace, &admin_cap, object::id_from_address(@0x111), vault::type_file(), string::utf8(b"Doc"), option::none(), 2048, ctx);

        vault::set_blob(&config, &workspace, &admin_cap, &mut v, 99, object::id_from_address(@0x333), object::id_from_address(@0x444), ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(v);
        ts::end(scenario);
    }

    #[test]
    fun test_vault_archive() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut v = vault::create(&config, &workspace, &admin_cap, object::id_from_address(@0x111), vault::type_note(), string::utf8(b"Note"), option::none(), 512, ctx);

        vault::archive(&config, &workspace, &admin_cap, &mut v, 0, ctx);
        assert!(vault::is_archived(&v));

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(v);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = vault::EAlreadyArchived)]
    fun test_vault_double_archive_fails() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut v = vault::create(&config, &workspace, &admin_cap, object::id_from_address(@0x111), vault::type_note(), string::utf8(b"Note"), option::none(), 512, ctx);

        vault::archive(&config, &workspace, &admin_cap, &mut v, 0, ctx);
        vault::archive(&config, &workspace, &admin_cap, &mut v, 1, ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(v);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = vault::EAlreadyArchived)]
    fun test_vault_set_blob_on_archived_fails() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut v = vault::create(&config, &workspace, &admin_cap, object::id_from_address(@0x111), vault::type_file(), string::utf8(b"Doc"), option::none(), 2048, ctx);

        vault::archive(&config, &workspace, &admin_cap, &mut v, 0, ctx);
        vault::set_blob(&config, &workspace, &admin_cap, &mut v, 1, object::id_from_address(@0x333), object::id_from_address(@0x444), ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(v);
        ts::end(scenario);
    }

    // ========== Policy Tests ==========

    #[test]
    fun test_workspace_policy_creation() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let p = policy::create_workspace_policy(&config, &workspace, &admin_cap, string::utf8(b"Default Access"), ctx);

        assert!(policy::rule_type(&p) == policy::rule_workspace_member());
        assert!(policy::version(&p) == 0);
        assert!(policy::allowed_addresses(&p).length() == 0);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(p);
        ts::end(scenario);
    }

    #[test]
    fun test_address_policy_creation() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let p = policy::create_address_policy(&config, &workspace, &admin_cap, string::utf8(b"Restricted"), vector[USER1, USER2], ctx);

        assert!(policy::rule_type(&p) == policy::rule_specific_address());
        assert!(policy::allowed_addresses(&p).length() == 2);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(p);
        ts::end(scenario);
    }

    #[test]
    fun test_role_policy_creation() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let p = policy::create_role_policy(&config, &workspace, &admin_cap, string::utf8(b"Admin Only"), 2, ctx);

        assert!(policy::rule_type(&p) == policy::rule_role_based());
        assert!(policy::min_role_level(&p) == 2);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(p);
        ts::end(scenario);
    }

    #[test]
    fun test_policy_add_address() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut p = policy::create_address_policy(&config, &workspace, &admin_cap, string::utf8(b"Custom"), vector[], ctx);

        policy::add_address(&config, &workspace, &admin_cap, &mut p, 0, USER1, ctx);
        assert!(policy::allowed_addresses(&p).length() == 1);
        assert!(policy::version(&p) == 1);

        policy::add_address(&config, &workspace, &admin_cap, &mut p, 1, USER2, ctx);
        assert!(policy::allowed_addresses(&p).length() == 2);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(p);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = policy::EVersionConflict)]
    fun test_policy_add_address_version_conflict() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let mut p = policy::create_address_policy(&config, &workspace, &admin_cap, string::utf8(b"Custom"), vector[], ctx);

        policy::add_address(&config, &workspace, &admin_cap, &mut p, 99, USER1, ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(p);
        ts::end(scenario);
    }

    // ========== seal_approve happy-path tests ==========

    #[test]
    fun test_seal_approve_workspace_member_passes() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let p = policy::create_workspace_policy(
            &config, &workspace, &admin_cap,
            string::utf8(b"Default"),
            ctx,
        );

        // ADMIN is the owner/member — should pass
        let correct_id = sui::address::to_bytes(object::id_address(&p));
        policy::seal_approve(correct_id, &p, &workspace, ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(p);
        ts::end(scenario);
    }

    #[test]
    fun test_seal_approve_address_list_passes() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let p = policy::create_address_policy(
            &config, &workspace, &admin_cap,
            string::utf8(b"Restricted"),
            vector[USER1],
            ctx,
        );

        let correct_id = sui::address::to_bytes(object::id_address(&p));

        test_utils::destroy(config);
        test_utils::destroy(admin_cap);

        // Switch to USER1 (in allowed list)
        ts::next_tx(&mut scenario, USER1);
        let ctx = ts::ctx(&mut scenario);

        policy::seal_approve(correct_id, &p, &workspace, ctx);

        test_utils::destroy(workspace);
        test_utils::destroy(p);
        ts::end(scenario);
    }

    #[test]
    fun test_seal_approve_role_based_passes() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (mut workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        // Add USER1 as admin (role level 2)
        workspace::add_member(&config, &mut workspace, &admin_cap, USER1, crm_core::acl::admin(), ctx);

        // Create policy requiring member level (1) — USER1 (admin=2) should pass
        let p = policy::create_role_policy(
            &config, &workspace, &admin_cap,
            string::utf8(b"Member+"),
            1,
            ctx,
        );

        let correct_id = sui::address::to_bytes(object::id_address(&p));

        test_utils::destroy(config);
        test_utils::destroy(admin_cap);

        // Switch to USER1
        ts::next_tx(&mut scenario, USER1);
        let ctx = ts::ctx(&mut scenario);

        policy::seal_approve(correct_id, &p, &workspace, ctx);

        test_utils::destroy(workspace);
        test_utils::destroy(p);
        ts::end(scenario);
    }
}
