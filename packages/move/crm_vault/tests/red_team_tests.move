#[test_only]
module crm_vault::red_team_tests {
    use std::string;
    use sui::test_scenario::{Self as ts};
    use sui::test_utils;
    use sui::clock;
    use crm_core::capabilities;
    use crm_core::workspace;
    use crm_vault::vault;
    use crm_vault::policy;

    const ADMIN: address = @0xA;
    const ATTACKER: address = @0xE;

    // ========== RT-1: seal_approve with wrong policy ID ==========
    // Attacker tries to call seal_approve with id bytes that don't match the policy object.
    // Should fail with ESealInvalidIdentity(1203).

    #[test]
    #[expected_failure(abort_code = policy::ESealInvalidIdentity)]
    fun test_seal_approve_wrong_id() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"WS-A"), ctx);

        let p = policy::create_workspace_policy(
            &config, &workspace, &admin_cap,
            string::utf8(b"Default"),
            0,
            ctx,
        );

        // Forge a wrong id (some random address bytes, not matching the policy object)
        let wrong_id = sui::address::to_bytes(@0xDEAD);
        let clk = clock::create_for_testing(ctx);

        // ADMIN is owner (member), so membership passes — fails on id mismatch
        policy::seal_approve(wrong_id, &p, &workspace, &clk, ctx);

        clock::destroy_for_testing(clk);
        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(p);
        ts::end(scenario);
    }

    // ========== RT-4: seal_approve non-member denied (WORKSPACE_MEMBER) ==========
    // Non-member tries to decrypt via workspace-member policy. Should fail with ESealNoAccess.

    #[test]
    #[expected_failure(abort_code = policy::ESealNoAccess)]
    fun test_seal_approve_non_member_workspace_policy() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"WS-A"), ctx);

        let p = policy::create_workspace_policy(
            &config, &workspace, &admin_cap,
            string::utf8(b"Default"),
            0,
            ctx,
        );

        let correct_id = sui::address::to_bytes(object::id_address(&p));
        let clk = clock::create_for_testing(ctx);

        test_utils::destroy(config);
        test_utils::destroy(admin_cap);

        // Switch to ATTACKER (not a workspace member)
        ts::next_tx(&mut scenario, ATTACKER);
        let ctx = ts::ctx(&mut scenario);

        policy::seal_approve(correct_id, &p, &workspace, &clk, ctx);

        clock::destroy_for_testing(clk);
        test_utils::destroy(workspace);
        test_utils::destroy(p);
        ts::end(scenario);
    }

    // ========== RT-5: seal_approve non-member denied (ROLE_BASED) ==========
    // Non-member tries to decrypt via role-based policy. Should fail with ESealNoAccess.

    #[test]
    #[expected_failure(abort_code = policy::ESealNoAccess)]
    fun test_seal_approve_non_member_role_policy() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"WS-A"), ctx);

        let p = policy::create_role_policy(
            &config, &workspace, &admin_cap,
            string::utf8(b"Admin Only"),
            0, // min_role_level = 0 (viewer), but non-member still fails
            0,
            ctx,
        );

        let correct_id = sui::address::to_bytes(object::id_address(&p));
        let clk = clock::create_for_testing(ctx);

        test_utils::destroy(config);
        test_utils::destroy(admin_cap);

        // Switch to ATTACKER (not a workspace member)
        ts::next_tx(&mut scenario, ATTACKER);
        let ctx = ts::ctx(&mut scenario);

        policy::seal_approve(correct_id, &p, &workspace, &clk, ctx);

        clock::destroy_for_testing(clk);
        test_utils::destroy(workspace);
        test_utils::destroy(p);
        ts::end(scenario);
    }

    // ========== RT-6: seal_approve insufficient role level ==========
    // Member with VIEWER role tries to decrypt ADMIN-level policy. Should fail with ESealNoAccess.

    #[test]
    #[expected_failure(abort_code = policy::ESealNoAccess)]
    fun test_seal_approve_insufficient_role() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (mut workspace, admin_cap) = workspace::create(&config, string::utf8(b"WS-A"), ctx);

        // Add ATTACKER as viewer (role level 0)
        workspace::add_member(&config, &mut workspace, &admin_cap, ATTACKER, crm_core::acl::viewer(), ctx);

        // Create policy requiring admin level (2)
        let p = policy::create_role_policy(
            &config, &workspace, &admin_cap,
            string::utf8(b"Admin Only"),
            2,
            0,
            ctx,
        );

        let correct_id = sui::address::to_bytes(object::id_address(&p));
        let clk = clock::create_for_testing(ctx);

        test_utils::destroy(config);
        test_utils::destroy(admin_cap);

        // Switch to ATTACKER (viewer, level 0 < required 2)
        ts::next_tx(&mut scenario, ATTACKER);
        let ctx = ts::ctx(&mut scenario);

        policy::seal_approve(correct_id, &p, &workspace, &clk, ctx);

        clock::destroy_for_testing(clk);
        test_utils::destroy(workspace);
        test_utils::destroy(p);
        ts::end(scenario);
    }

    // ========== RT-7: seal_approve cross-workspace policy ==========
    // Attacker passes wrong workspace to bypass membership check.
    // Should fail with EWorkspaceMismatch.

    #[test]
    #[expected_failure(abort_code = policy::EWorkspaceMismatch)]
    fun test_seal_approve_cross_workspace() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (ws_a, cap_a) = workspace::create(&config, string::utf8(b"WS-A"), ctx);
        let (ws_b, _cap_b) = workspace::create(&config, string::utf8(b"WS-B"), ctx);

        // Create policy in WS-A
        let p = policy::create_workspace_policy(
            &config, &ws_a, &cap_a,
            string::utf8(b"Default"),
            0,
            ctx,
        );

        let correct_id = sui::address::to_bytes(object::id_address(&p));
        let clk = clock::create_for_testing(ctx);

        // ADMIN is member of both workspaces, but pass WS-B for WS-A's policy
        policy::seal_approve(correct_id, &p, &ws_b, &clk, ctx);

        clock::destroy_for_testing(clk);
        test_utils::destroy(config);
        test_utils::destroy(ws_a);
        test_utils::destroy(ws_b);
        test_utils::destroy(cap_a);
        test_utils::destroy(_cap_b);
        test_utils::destroy(p);
        ts::end(scenario);
    }

    // ========== RT-2: Cross-workspace vault mutation ==========
    // Create vault in WS-A, try to archive it using WS-B's cap + workspace.
    // Should fail with EWorkspaceMismatch(1101).

    #[test]
    #[expected_failure(abort_code = vault::EWorkspaceMismatch)]
    fun test_cross_workspace_vault_archive() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (ws_a, cap_a) = workspace::create(&config, string::utf8(b"WS-A"), ctx);
        let (ws_b, cap_b) = workspace::create(&config, string::utf8(b"WS-B"), ctx);

        // Create vault in WS-A
        let mut v = vault::create(
            &config, &ws_a, &cap_a,
            object::id_from_address(@0x111),
            vault::type_note(),
            string::utf8(b"Secret Note"),
            option::none(),
            512,
            ctx,
        );

        // Attacker uses WS-B cap + workspace to archive vault belonging to WS-A
        vault::archive(&config, &ws_b, &cap_b, &mut v, 0, ctx);

        test_utils::destroy(config);
        test_utils::destroy(ws_a);
        test_utils::destroy(ws_b);
        test_utils::destroy(cap_a);
        test_utils::destroy(cap_b);
        test_utils::destroy(v);
        ts::end(scenario);
    }

    // ========== RT-3: Archived vault mutation ==========
    // Archive a vault, then try to set_blob on it.
    // Should fail with EAlreadyArchived(1102).

    #[test]
    #[expected_failure(abort_code = vault::EAlreadyArchived)]
    fun test_archived_vault_set_blob() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"WS-A"), ctx);

        let mut v = vault::create(
            &config, &workspace, &admin_cap,
            object::id_from_address(@0x111),
            vault::type_file(),
            string::utf8(b"Doc"),
            option::none(),
            2048,
            ctx,
        );

        // Archive first
        vault::archive(&config, &workspace, &admin_cap, &mut v, 0, ctx);

        // Try to set_blob on archived vault — should abort
        vault::set_blob(
            &config, &workspace, &admin_cap, &mut v,
            1, // version bumped to 1 after archive
            object::id_from_address(@0x333),
            object::id_from_address(@0x444),
            ctx,
        );

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(v);
        ts::end(scenario);
    }
}
