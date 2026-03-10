# ROSMAR CRM -- Security Test Report

**Date:** 2026-03-10
**Environment:** SUI Move (Testnet-compatible), NestJS 11 + Prisma 7 (BFF)
**Total Tests:** 328 (143 Move + 185 BFF)
**Pass Rate:** 100% (328/328)
**Failed:** 0

---

## 1. Executive Summary

All 328 tests across the Move smart contracts and BFF backend pass. The test suite includes:

- **143 Move tests** across 5 packages (crm_core, crm_data, crm_escrow, crm_vault, crm_action)
- **185 BFF tests** across 35 test suites covering all backend modules
- **24 red-team attack vectors** across all 5 Move packages, all passing (attacks correctly rejected)

The red-team tests validate security invariants including cross-workspace isolation, capability enforcement, state machine integrity, arithmetic overflow protection, and unauthorized access prevention.

---

## 2. Move Test Results

### crm_core (59 tests) -- ALL PASSED

**Unit Tests (crm_core_tests):**

| # | Test | Status |
|---|---|---|
| 1 | `test_add_wallet_with_correct_cap_succeeds` | PASS |
| 2 | `test_add_wallet_wrong_cap_fails` | PASS |
| 3 | `test_create_and_update_deal` | PASS |
| 4 | `test_create_profile` | PASS |
| 5 | `test_create_relation` | PASS |
| 6 | `test_deal_invalid_stage_transition` | PASS |
| 7 | `test_deal_terminal_stage_no_transition` | PASS |
| 8 | `test_deal_valid_stage_transition` | PASS |
| 9 | `test_member_operations` | PASS |
| 10 | `test_organization_creation` | PASS |
| 11 | `test_pause_threshold_reached` | PASS |
| 12 | `test_profile_operations` | PASS |
| 13 | `test_rate_limit_operations` | PASS |
| 14 | `test_remove_member` | PASS |
| 15 | `test_role_levels` | PASS |
| 16 | `test_single_vote_insufficient` | PASS |
| 17 | `test_workspace_creation` | PASS |

**Red Team Tests (6 attack vectors):**

| # | Test | Attack Vector | Status |
|---|---|---|---|
| 1 | Cross-workspace cap | Use WorkspaceAdminCap from workspace A on workspace B | PASS (rejected) |
| 2 | Non-owner recovery | Non-owner tries to recover admin cap | PASS (rejected) |
| 3 | Cross-workspace object | Operate on object from different workspace | PASS (rejected) |
| 4 | DoS mass members | Attempt to add excessive members | PASS (rejected) |
| 5 | Type confusion metadata | Use wrong type for dynamic field metadata | PASS (rejected) |
| 6 | Pause bypass | Attempt operations while system is paused | PASS (rejected) |

### crm_escrow (29 tests) -- ALL PASSED

**Unit Tests (escrow_tests):**

| # | Test | Status |
|---|---|---|
| 1 | `test_cannot_release_during_dispute` | PASS |
| 2 | `test_commit_and_reveal_vote` | PASS |
| 3 | `test_create_and_fund_escrow` | PASS |
| 4 | `test_dispute_and_resolve_refund` | PASS |
| 5 | `test_dispute_and_resolve_release` | PASS |
| 6 | `test_double_commit_fails` | PASS |
| 7 | `test_double_vote` | PASS |
| 8 | `test_linear_vesting` | PASS |
| 9 | `test_milestone_invalid_sum` | PASS |
| 10 | `test_milestone_vesting` | PASS |
| 11 | `test_payee_claim_before_expiry` | PASS |
| 12 | `test_payee_claim_outside_window_fails` | PASS |
| 13 | `test_payer_refund_only_after_expiry` | PASS |
| 14 | `test_refund_expired` | PASS |
| 15 | `test_refund_funded` | PASS |
| 16 | `test_refund_unfunded` | PASS |
| 17 | `test_release_before_min_lock` | PASS |
| 18 | `test_release_full` | PASS |
| 19 | `test_release_partial` | PASS |
| 20 | `test_reveal_vote_mismatch` | PASS |
| 21 | `test_unauthorized_release` | PASS |

**Red Team Tests (8 attack vectors):**

| # | Test | Attack Vector | Status |
|---|---|---|---|
| 1 | Claim outside window | Payee claims outside the 24h claim window | PASS (rejected) |
| 2 | Double vote | Arbitrator tries to vote twice | PASS (rejected) |
| 3 | Milestone overflow | Milestones with percentages not summing to 10000bp | PASS (rejected) |
| 4 | Non-arbitrator vote | Non-arbitrator tries to vote on dispute | PASS (rejected) |
| 5 | Refund before expiry | Payer tries to refund before escrow expires | PASS (rejected) |
| 6 | Release before cliff | Release vested funds before cliff period | PASS (rejected) |
| 7 | Release exceeds balance | Release more than available balance | PASS (rejected) |
| 8 | Release zero amount | Release zero amount | PASS (rejected) |

### crm_action (19 tests) -- ALL PASSED

**Unit Tests (crm_action_tests):**

| # | Test | Status |
|---|---|---|
| 1 | `test_batch_airdrop_empty_recipients` | PASS |
| 2 | `test_batch_airdrop_equal` | PASS |
| 3 | `test_batch_airdrop_insufficient_funds` | PASS |
| 4 | `test_batch_airdrop_variable` | PASS |
| 5 | `test_batch_airdrop_with_remainder` | PASS |
| 6 | `test_reward_batch_distribute` | PASS |
| 7 | `test_reward_distribute` | PASS |
| 8 | `test_reward_distribute_draft_campaign_fails` | PASS |
| 9 | `test_reward_distribute_insufficient_funds` | PASS |

**Unit Tests (quest_badge_tests):**

| # | Test | Status |
|---|---|---|
| 1 | `test_accessors` | PASS |
| 2 | `test_badge_not_transferable` | PASS |
| 3 | `test_mint_badge` | PASS |
| 4 | `test_mint_badge_dedup` | PASS |
| 5 | `test_mint_badge_different_recipients` | PASS |
| 6 | `test_mint_requires_admin_cap` | PASS |
| 7 | `test_mint_when_paused` | PASS |

**Red Team Tests (3 attack vectors):**

| # | Test | Attack Vector | Status |
|---|---|---|---|
| 1 | `test_airdrop_empty_recipients` | Airdrop with empty recipient list | PASS (rejected) |
| 2 | `test_airdrop_insufficient_funds` | Airdrop with insufficient coin balance | PASS (rejected) |
| 3 | `test_reward_distribute_draft_campaign` | Distribute rewards from a draft (non-active) campaign | PASS (rejected) |

### crm_data (22 tests) -- ALL PASSED

**Unit Tests (crm_data_tests):**

| # | Test | Status |
|---|---|---|
| 1 | `test_campaign_cannot_complete_draft` | PASS |
| 2 | `test_campaign_cannot_pause_draft` | PASS |
| 3 | `test_campaign_creation` | PASS |
| 4 | `test_campaign_lifecycle_draft_active_paused_active_completed` | PASS |
| 5 | `test_deal_archive` | PASS |
| 6 | `test_deal_creation` | PASS |
| 7 | `test_deal_invalid_transition_won_to_qualified` | PASS |
| 8 | `test_deal_skip_to_lost` | PASS |
| 9 | `test_deal_stage_progression` | PASS |
| 10 | `test_segment_creation` | PASS |
| 11 | `test_segment_update_member_count` | PASS |
| 12 | `test_segment_update_rule_hash` | PASS |
| 13 | `test_segment_version_conflict` | PASS |
| 14 | `test_ticket_assign` | PASS |
| 15 | `test_ticket_creation` | PASS |
| 16 | `test_ticket_invalid_transition_open_to_resolved` | PASS |
| 17 | `test_ticket_reopen_from_resolved` | PASS |
| 18 | `test_ticket_status_progression` | PASS |

**Red Team Tests (4 attack vectors):**

| # | Test | Attack Vector | Status |
|---|---|---|---|
| 1 | `test_campaign_draft_to_completed` | Skip campaign lifecycle (draft -> completed) | PASS (rejected) |
| 2 | `test_deal_archive_then_advance` | Advance stage on an archived deal | PASS (rejected) |
| 3 | `test_segment_cross_workspace_update` | Update segment from wrong workspace | PASS (rejected) |
| 4 | `test_ticket_reclose_after_closed` | Close an already-closed ticket | PASS (rejected) |

### crm_vault (14 tests) -- ALL PASSED

**Unit Tests (crm_vault_tests):**

| # | Test | Status |
|---|---|---|
| 1 | `test_address_policy_creation` | PASS |
| 2 | `test_policy_add_address` | PASS |
| 3 | `test_policy_add_address_version_conflict` | PASS |
| 4 | `test_role_policy_creation` | PASS |
| 5 | `test_vault_archive` | PASS |
| 6 | `test_vault_creation` | PASS |
| 7 | `test_vault_double_archive_fails` | PASS |
| 8 | `test_vault_set_blob` | PASS |
| 9 | `test_vault_set_blob_on_archived_fails` | PASS |
| 10 | `test_vault_set_blob_version_conflict` | PASS |
| 11 | `test_workspace_policy_creation` | PASS |

**Red Team Tests (3 attack vectors):**

| # | Test | Attack Vector | Status |
|---|---|---|---|
| 1 | `test_archived_vault_set_blob` | Set blob on archived vault | PASS (rejected) |
| 2 | `test_cross_workspace_vault_archive` | Archive vault from wrong workspace | PASS (rejected) |
| 3 | `test_seal_approve_wrong_id` | Call seal_approve with mismatched policy ID | PASS (rejected) |

---

## 3. BFF Test Results (185 tests) -- ALL PASSED

| Module | Test Suite(s) | Tests | Status |
|---|---|---|---|
| **App** | app.controller | - | ALL PASS |
| **Auth** | auth.service | - | ALL PASS |
| **Profile** | profile.service, profile-assets | - | ALL PASS |
| **Deal** | deal.service, deal-stage, deal-document, escrow.service | - | ALL PASS |
| **Organization** | organization | - | ALL PASS |
| **Vault** | vault.service, vault-audit, vault-policy | - | ALL PASS |
| **Campaign** | workflow-actions, trigger-matcher | - | ALL PASS |
| **Segment** | segment.service, segment-diff.job | - | ALL PASS |
| **Ticket** | ticket | - | ALL PASS |
| **Broadcast** | broadcast.service, channel-adapters | - | ALL PASS |
| **Social** | social-link, adapters, discord-oauth | - | ALL PASS |
| **Agent (AI)** | llm-client, analyst, action, content, usage-tracking | - | ALL PASS |
| **Engagement** | engagement | - | ALL PASS |
| **Auto-Tag** | service, listener | - | ALL PASS |
| **Webhook** | whale-alert.listener | - | ALL PASS |
| **GDPR** | gdpr | - | ALL PASS |
| **Jobs** | broadcast-send, vault-expiry | - | ALL PASS |
| **Blockchain** | solana-resolver, evm-resolver, gas-sponsor | - | ALL PASS |
| **Notification** | notification | - | ALL PASS |
| **Quest** | quest-verification | - | ALL PASS |
| **Common** | cache.service | - | ALL PASS |

**35 test suites, 185 tests, 0 failures.**

---

## 4. Red Team Coverage Summary

**24 attack vectors across 5 Move packages -- all correctly rejected.**

| Package | Attack Vectors | Categories |
|---|---|---|
| crm_core (6) | Cross-workspace cap, non-owner recovery, cross-workspace object, DoS mass members, type confusion metadata, pause bypass | Access control, isolation, DoS, type safety |
| crm_escrow (8) | Claim outside window, double vote, milestone overflow, non-arbitrator vote, refund before expiry, release before cliff, release exceeds balance, release zero amount | Financial integrity, timing, arithmetic, authorization |
| crm_action (3) | Empty recipients, insufficient funds, draft campaign distribute | Input validation, financial integrity |
| crm_data (4) | Draft-to-completed skip, archived deal advance, cross-workspace segment, re-close closed ticket | State machine integrity, isolation |
| crm_vault (3) | Archived vault set_blob, cross-workspace archive, seal_approve ID mismatch | State integrity, isolation, cryptographic identity |

### Security Properties Verified:

1. **Capability isolation** -- WorkspaceAdminCap cannot be used across workspaces
2. **State machine enforcement** -- Invalid state transitions abort (deals, campaigns, tickets, escrow)
3. **Financial safety** -- Cannot release more than balance, cannot refund before expiry, milestone percentages must sum to 10000bp
4. **Pause guard** -- All mutating operations check `assert_not_paused`
5. **Timing enforcement** -- Min lock duration, claim window bounds, reveal deadline
6. **Deduplication** -- QuestBadge mint dedup via shared registry + Table
7. **Commit-reveal integrity** -- Hash mismatch on reveal correctly rejected
8. **Soul-bound enforcement** -- QuestBadge has no `store` ability (non-transferable)

---

## 5. Coverage Gaps

### Move -- Areas NOT fully covered:

| Gap | Severity | Description |
|---|---|---|
| **`multi_sig_pause` edge cases** | Medium | No test for proposal with threshold=voter_count (all-must-sign), or creating proposal while system is already paused/unpaused. |
| **`admin_recovery` while paused** | Low | No explicit test that `recover_admin_cap` fails when system is paused (implied by `assert_not_paused` but not tested). |
| **`profile::set_metadata` type variations** | Low | Tested with one type; no test with different generic types to verify type safety across metadata keys. |
| **`organization::set_metadata`** | Low | Same gap as profile -- no type variation tests. |
| **`escrow::release_vested` with linear vesting** | Low | Linear vesting calc tested but no red-team test for edge cases like `total_duration_ms = 0` or `elapsed = 0`. |
| **`escrow` concurrent access** | Medium | No test for race conditions on shared Escrow object (two arbitrators voting simultaneously). SUI's object model handles this, but explicit tests would improve confidence. |
| **`policy::seal_approve` for WORKSPACE_MEMBER and ROLE_BASED rules** | Medium | `seal_approve` allows all callers for WORKSPACE_MEMBER and ROLE_BASED rules (enforcement is off-chain). No test verifies the BFF-side enforcement is actually applied. |
| **`airdrop::batch_airdrop_variable` length mismatch** | Low | No test where `recipients.length != amounts.length`. |
| **Unbounded vector inputs** | Medium | No test that verifies behavior with very large vectors (>1000 recipients, >100 arbitrators). These would exceed gas limits but the contracts have no explicit caps. |
| **`capabilities::check_user_rate_limit` Table cleanup** | Low | No test for long-term Table growth behavior. |

### BFF -- Areas NOT fully covered:

| Gap | Severity | Description |
|---|---|---|
| **End-to-end Move TX integration** | High | BFF tests mock the SUI chain interaction (`SUI_DRY_RUN=true`). No integration test sends real transactions. |
| **Rate limiting under concurrent load** | Medium | No stress test for ThrottleConfig / rate limiting with concurrent requests. |
| **GDPR deletion completeness** | Medium | GDPR module tested but no verification that ALL personal data across ALL tables is actually purged. |
| **Webhook signature verification** | Low | whale-alert.listener tested but no test for forged/invalid webhook signatures. |

---

## 6. Recommendations

### Priority 1 -- Add immediately:

1. **Add `MAX_BATCH_SIZE` constant** to `airdrop::batch_airdrop`, `batch_airdrop_variable`, and `reward::batch_distribute`. Without this, any admin cap holder can craft a transaction that exhausts gas. Suggested cap: 500 recipients.

2. **Add `MAX_ARBITRATORS` constant** to `escrow::create_escrow`. Suggested cap: 21.

3. **Add `MAX_MILESTONES` constant** to `escrow::add_vesting`. Suggested cap: 50.

4. **Test `multi_sig_pause` with threshold = voter_count** (unanimity requirement).

### Priority 2 -- Add before production:

5. **BFF integration test** with real SUI devnet transactions (at least for escrow::create + fund + release happy path).

6. **Test `seal_approve` enforcement** end-to-end -- verify that WORKSPACE_MEMBER rule actually checks membership when called from BFF (currently enforcement is entirely off-chain and `seal_approve` allows any caller).

7. **Add `batch_airdrop_variable` recipients/amounts length mismatch** red-team test.

8. **Stress test** airdrop/batch functions with 100+ recipients to baseline gas costs.

### Priority 3 -- Nice to have:

9. **Fuzz testing** for vesting math (`calc_linear_vested`, `calc_milestone_vested_from_bp`) with edge case inputs.

10. **Property-based testing** for deal/ticket/campaign state machines -- generate random transition sequences and verify only valid ones succeed.

11. **Table growth monitoring** -- add off-chain monitoring for `PerUserRateLimit` and `QuestRegistry` table sizes.

12. **GDPR audit trail** -- verify deletion executor removes all Prisma relations (cascade behavior).
