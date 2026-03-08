#[test_only]
module crm_action::red_team_tests {
    use std::string;
    use sui::test_scenario::{Self as ts};
    use sui::test_utils;
    use sui::coin;
    use sui::sui::SUI;
    use crm_core::capabilities;
    use crm_core::workspace;
    use crm_data::campaign;
    use crm_action::airdrop;
    use crm_action::reward;

    const ADMIN: address = @0xA;
    const USER1: address = @0xB;

    // ========== RT-1: Airdrop with 0 recipients ==========
    // Should fail with EEmptyRecipients(1300).

    #[test]
    #[expected_failure(abort_code = airdrop::EEmptyRecipients)]
    fun test_airdrop_empty_recipients() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let fund = coin::mint_for_testing<SUI>(1000, ctx);
        airdrop::batch_airdrop(
            &config, &workspace, &admin_cap,
            vector[], // empty recipients
            fund,
            100,
            ctx,
        );

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        ts::end(scenario);
    }

    // ========== RT-2: Airdrop insufficient funds ==========
    // 2 recipients x 1000 = 2000 needed, but only 500 in fund.
    // Should fail with EInsufficientFunds(1301).

    #[test]
    #[expected_failure(abort_code = airdrop::EInsufficientFunds)]
    fun test_airdrop_insufficient_funds() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let fund = coin::mint_for_testing<SUI>(500, ctx);
        airdrop::batch_airdrop(
            &config, &workspace, &admin_cap,
            vector[USER1, @0xC],
            fund,
            1000, // 2 x 1000 = 2000 > 500
            ctx,
        );

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        ts::end(scenario);
    }

    // ========== RT-3: Reward to inactive (DRAFT) campaign ==========
    // Campaign is still DRAFT, reward::distribute should fail with ECampaignNotActive(1401).

    #[test]
    #[expected_failure(abort_code = reward::ECampaignNotActive)]
    fun test_reward_distribute_draft_campaign() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let segment_id = object::id_from_address(@0x111);

        // Campaign stays in DRAFT — never launched
        let camp = campaign::create(
            &config, &workspace, &admin_cap,
            string::utf8(b"Draft Camp"),
            segment_id,
            option::none(),
            ctx,
        );

        let fund = coin::mint_for_testing<SUI>(1000, ctx);
        reward::distribute(
            &config, &workspace, &admin_cap,
            &camp,
            USER1,
            500,
            string::utf8(b"token"),
            fund,
            ctx,
        );

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(camp);
        ts::end(scenario);
    }
}
