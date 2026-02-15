#[test_only]
module crm_action::crm_action_tests {
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
    const USER2: address = @0xC;
    const USER3: address = @0xD;

    // ========== Airdrop Tests ==========

    #[test]
    fun test_batch_airdrop_equal() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let fund = coin::mint_for_testing<SUI>(3000, ctx);
        let recipients = vector[USER1, USER2, USER3];

        airdrop::batch_airdrop(&config, &workspace, &admin_cap, recipients, fund, 1000, ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        ts::end(scenario);
    }

    #[test]
    fun test_batch_airdrop_with_remainder() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        // 5000 fund, 3 recipients x 1000 = 3000, remainder 2000 returned
        let fund = coin::mint_for_testing<SUI>(5000, ctx);
        let recipients = vector[USER1, USER2, USER3];

        airdrop::batch_airdrop(&config, &workspace, &admin_cap, recipients, fund, 1000, ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = airdrop::EEmptyRecipients)]
    fun test_batch_airdrop_empty_recipients() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let fund = coin::mint_for_testing<SUI>(1000, ctx);
        airdrop::batch_airdrop(&config, &workspace, &admin_cap, vector[], fund, 100, ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = airdrop::EInsufficientFunds)]
    fun test_batch_airdrop_insufficient_funds() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let fund = coin::mint_for_testing<SUI>(100, ctx);
        airdrop::batch_airdrop(&config, &workspace, &admin_cap, vector[USER1, USER2], fund, 1000, ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        ts::end(scenario);
    }

    #[test]
    fun test_batch_airdrop_variable() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);

        let fund = coin::mint_for_testing<SUI>(6000, ctx);
        let recipients = vector[USER1, USER2, USER3];
        let amounts = vector[1000, 2000, 3000];

        airdrop::batch_airdrop_variable(&config, &workspace, &admin_cap, recipients, amounts, fund, ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        ts::end(scenario);
    }

    // ========== Reward Tests ==========

    #[test]
    fun test_reward_distribute() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let segment_id = object::id_from_address(@0x111);
        let mut camp = campaign::create(&config, &workspace, &admin_cap, string::utf8(b"Camp"), segment_id, option::none(), ctx);

        // Activate campaign
        campaign::launch(&config, &workspace, &admin_cap, &mut camp, ctx);

        let fund = coin::mint_for_testing<SUI>(5000, ctx);
        reward::distribute(&config, &workspace, &admin_cap, &camp, USER1, 1000, string::utf8(b"token"), fund, ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(camp);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = reward::ECampaignNotActive)]
    fun test_reward_distribute_draft_campaign_fails() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let segment_id = object::id_from_address(@0x111);
        let camp = campaign::create(&config, &workspace, &admin_cap, string::utf8(b"Camp"), segment_id, option::none(), ctx);

        // Campaign is still draft — should fail
        let fund = coin::mint_for_testing<SUI>(1000, ctx);
        reward::distribute(&config, &workspace, &admin_cap, &camp, USER1, 500, string::utf8(b"token"), fund, ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(camp);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = reward::EInsufficientFunds)]
    fun test_reward_distribute_insufficient_funds() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let segment_id = object::id_from_address(@0x111);
        let mut camp = campaign::create(&config, &workspace, &admin_cap, string::utf8(b"Camp"), segment_id, option::none(), ctx);
        campaign::launch(&config, &workspace, &admin_cap, &mut camp, ctx);

        let fund = coin::mint_for_testing<SUI>(100, ctx);
        reward::distribute(&config, &workspace, &admin_cap, &camp, USER1, 500, string::utf8(b"token"), fund, ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(camp);
        ts::end(scenario);
    }

    #[test]
    fun test_reward_batch_distribute() {
        let mut scenario = ts::begin(ADMIN);
        let ctx = ts::ctx(&mut scenario);
        let config = capabilities::test_create_config(ctx);
        let (workspace, admin_cap) = workspace::create(&config, string::utf8(b"Test"), ctx);
        let segment_id = object::id_from_address(@0x111);
        let mut camp = campaign::create(&config, &workspace, &admin_cap, string::utf8(b"Camp"), segment_id, option::none(), ctx);
        campaign::launch(&config, &workspace, &admin_cap, &mut camp, ctx);

        let fund = coin::mint_for_testing<SUI>(3000, ctx);
        reward::batch_distribute(&config, &workspace, &admin_cap, &camp, vector[USER1, USER2, USER3], 1000, string::utf8(b"token"), fund, ctx);

        test_utils::destroy(config);
        test_utils::destroy(workspace);
        test_utils::destroy(admin_cap);
        test_utils::destroy(camp);
        ts::end(scenario);
    }
}
