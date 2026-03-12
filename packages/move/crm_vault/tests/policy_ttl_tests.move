#[test_only]
module crm_vault::policy_ttl_tests {
    use std::string;
    use sui::test_scenario::{Self as ts};
    use sui::test_utils;
    use sui::clock;
    use crm_core::capabilities;
    use crm_core::workspace;
    use crm_vault::policy;

    const ADMIN: address = @0xA;

    #[test]
    fun test_create_policy_with_ttl() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        // expires_at_ms = 3_600_000 (1 hour from epoch 0)
        let p = policy::create_workspace_policy(
            &config, &workspace, &admin_cap,
            string::utf8(b"TTL Policy"),
            3_600_000,
            ctx,
        );

        assert!(policy::expires_at_ms(&p) == 3_600_000);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(p);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = policy::EPolicyExpired)]
    fun test_seal_approve_rejects_expired_policy() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        // Policy expires at 100ms
        let p = policy::create_workspace_policy(
            &config, &workspace, &admin_cap,
            string::utf8(b"Short TTL"),
            100,
            ctx,
        );

        let correct_id = sui::address::to_bytes(object::id_address(&p));

        // Create clock at time 200 (past expiry)
        let mut clk = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clk, 200);

        policy::seal_approve(correct_id, &p, &workspace, &clk, ctx);

        clock::destroy_for_testing(clk);
        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(p);
        ts::end(scenario);
    }

    #[test]
    fun test_seal_approve_allows_before_expiry() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        // Policy expires at 10000ms
        let p = policy::create_workspace_policy(
            &config, &workspace, &admin_cap,
            string::utf8(b"Long TTL"),
            10_000,
            ctx,
        );

        let correct_id = sui::address::to_bytes(object::id_address(&p));

        // Clock at 5000 — before expiry
        let mut clk = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clk, 5_000);

        policy::seal_approve(correct_id, &p, &workspace, &clk, ctx);

        clock::destroy_for_testing(clk);
        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(p);
        ts::end(scenario);
    }

    #[test]
    fun test_policy_without_ttl_never_expires() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        // expires_at_ms = 0 means no TTL
        let p = policy::create_workspace_policy(
            &config, &workspace, &admin_cap,
            string::utf8(b"No TTL"),
            0,
            ctx,
        );

        let correct_id = sui::address::to_bytes(object::id_address(&p));

        // Clock far in the future
        let mut clk = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clk, 999_999_999_999);

        policy::seal_approve(correct_id, &p, &workspace, &clk, ctx);

        clock::destroy_for_testing(clk);
        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(p);
        ts::end(scenario);
    }
}
