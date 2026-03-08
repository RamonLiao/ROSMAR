#[test_only]
module crm_core::red_team_tests {
    use std::string;
    use sui::test_scenario::{Self as ts};
    use sui::test_utils;
    use crm_core::capabilities;
    use crm_core::workspace;
    use crm_core::profile;
    use crm_core::relation;
    use crm_core::admin_recovery;

    const ATTACKER: address = @0xBAD;
    const VICTIM: address = @0xAAA;

    // ============================================================
    // 1. Cross-workspace cap attack
    //    Use cap from workspace A to create profile in workspace B.
    // ============================================================
    #[test]
    #[expected_failure(abort_code = capabilities::ECapMismatch)]
    fun red_team_cross_workspace_cap_attack() {
        let mut scenario = ts::begin(VICTIM);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);

        // Workspace A (victim)
        let (workspace_a, cap_a) = workspace::create(&config, string::utf8(b"WS-A"), ctx);
        // Workspace B (attacker)
        let (workspace_b, cap_b) = workspace::create(&config, string::utf8(b"WS-B"), ctx);

        // Attack: use cap_a to create profile in workspace_b → ECapMismatch
        let bad_profile = profile::create(
            &config, &workspace_b, &cap_a,
            ATTACKER, option::none(), vector[], ctx,
        );

        test_utils::destroy(config);
        test_utils::destroy(workspace_a);
        test_utils::destroy(workspace_b);
        test_utils::destroy(cap_a);
        test_utils::destroy(cap_b);
        test_utils::destroy(bad_profile);
        ts::end(scenario);
    }

    // ============================================================
    // 2. Non-owner admin cap recovery
    //    Attacker (not owner) tries to recover admin cap.
    // ============================================================
    #[test]
    #[expected_failure(abort_code = admin_recovery::ENotWorkspaceOwner)]
    fun red_team_non_owner_admin_recovery() {
        let mut scenario = ts::begin(VICTIM);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, legit_cap) = workspace::create(&config, string::utf8(b"WS"), ctx);

        // Switch to attacker
        ts::next_tx(&mut scenario, ATTACKER);
        let ctx2 = ts::ctx(&mut scenario);

        // Attack: ATTACKER is not owner → ENotWorkspaceOwner
        let stolen_cap = admin_recovery::recover_admin_cap(&config, &workspace, ctx2);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(legit_cap);
        test_utils::destroy(stolen_cap);
        ts::end(scenario);
    }

    // ============================================================
    // 3. Cross-workspace object manipulation
    //    Create profile in WS-A, then try to archive it via WS-B.
    //    The profile's workspace_id won't match → EWorkspaceMismatch.
    // ============================================================
    #[test]
    #[expected_failure(abort_code = profile::EWorkspaceMismatch)]
    fun red_team_cross_workspace_object_manipulation() {
        let mut scenario = ts::begin(VICTIM);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);

        let (workspace_a, cap_a) = workspace::create(&config, string::utf8(b"WS-A"), ctx);
        let (workspace_b, cap_b) = workspace::create(&config, string::utf8(b"WS-B"), ctx);

        // Create profile in WS-A
        let mut profile_a = profile::create(
            &config, &workspace_a, &cap_a,
            VICTIM, option::none(), vector[], ctx,
        );

        // Attack: archive profile_a using WS-B context → EWorkspaceMismatch
        profile::archive(&config, &workspace_b, &cap_b, &mut profile_a, 0, ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace_a);
        test_utils::destroy(workspace_b);
        test_utils::destroy(cap_a);
        test_utils::destroy(cap_b);
        test_utils::destroy(profile_a);
        ts::end(scenario);
    }

    // ============================================================
    // 4. Mass add_member DoS — per-user rate limit stops abuse
    //    Exhaust the per-user rate limit, then one more call aborts.
    // ============================================================
    #[test]
    #[expected_failure(abort_code = capabilities::EUserRateLimitExceeded)]
    fun red_team_mass_add_member_dos() {
        let mut scenario = ts::begin(ATTACKER);
        let ctx = ts::ctx(&mut scenario);
        let workspace_id = object::id_from_address(@0x123);
        let mut rate = capabilities::create_per_user_rate_limit(workspace_id, 3, ctx);

        // Simulate attacker hammering the same workspace
        capabilities::check_user_rate_limit(&mut rate, ATTACKER, 1);
        capabilities::check_user_rate_limit(&mut rate, ATTACKER, 1);
        capabilities::check_user_rate_limit(&mut rate, ATTACKER, 1);
        // 4th call exceeds limit → EUserRateLimitExceeded
        capabilities::check_user_rate_limit(&mut rate, ATTACKER, 1);

        test_utils::destroy(rate);
        ts::end(scenario);
    }

    // ============================================================
    // 5. Type confusion via set_metadata
    //    set_metadata<String> then overwrite same key with set_metadata<u64>.
    //    Move's dynamic_field uses type in the key, so borrow_mut<String>
    //    on a u64 field (or vice versa) would fail. However the current
    //    impl uses the same String key without type tag, so overwriting
    //    with a different V triggers a type-safety abort from dynamic_field.
    // ============================================================
    #[test]
    #[expected_failure]
    fun red_team_type_confusion_metadata() {
        let mut scenario = ts::begin(VICTIM);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, cap) = workspace::create(&config, string::utf8(b"WS"), ctx);
        let mut prof = profile::create(
            &config, &workspace, &cap,
            VICTIM, option::none(), vector[], ctx,
        );

        // Set metadata as String
        profile::set_metadata<string::String>(
            &config, &workspace, &cap, &mut prof, 0,
            string::utf8(b"score"), string::utf8(b"high"), ctx,
        );

        // Attack: overwrite same key with u64 → type mismatch abort
        profile::set_metadata<u64>(
            &config, &workspace, &cap, &mut prof, 1,
            string::utf8(b"score"), 9999, ctx,
        );

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(cap);
        test_utils::destroy(prof);
        ts::end(scenario);
    }

    // ============================================================
    // 6. Pause system bypass
    //    Pause the system, then try to create a profile → EPaused.
    // ============================================================
    #[test]
    #[expected_failure(abort_code = capabilities::EPaused)]
    fun red_team_pause_bypass() {
        let mut scenario = ts::begin(VICTIM);
        let ctx = ts::ctx(&mut scenario);
        let mut config = capabilities::test_create_config(ctx);
        let pause_cap = capabilities::test_create_pause_cap(ctx);
        let (workspace, cap) = workspace::create(&config, string::utf8(b"WS"), ctx);

        // Pause the system
        capabilities::pause(&mut config, &pause_cap, string::utf8(b"Emergency"));

        // Attack: try to create profile while paused → EPaused
        let bad_profile = profile::create(
            &config, &workspace, &cap,
            ATTACKER, option::none(), vector[], ctx,
        );

        test_utils::destroy(config);
        test_utils::destroy(pause_cap);
        test_utils::destroy(workspace);
        test_utils::destroy(cap);
        test_utils::destroy(bad_profile);
        ts::end(scenario);
    }
}
