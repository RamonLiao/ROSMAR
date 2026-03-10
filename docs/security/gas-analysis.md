# ROSMAR CRM -- On-Chain Gas Analysis

**Date:** 2026-03-10
**Method:** Theoretical static analysis of Move source code (SUI CLI does not support `--gas-tracking` per-test)
**Packages analyzed:** crm_core, crm_data, crm_escrow, crm_vault, crm_action

---

## SUI Gas Model Notes

SUI gas is composed of three components:

| Component | Description |
|---|---|
| **Computation** | CPU cycles for instruction execution (arithmetic, branching, hash computation). Priced per instruction tier. |
| **Storage** | Creating new objects or expanding existing ones costs storage gas proportional to byte size. Refunded partially when objects are deleted. |
| **Object Access** | Each object read/write in a transaction incurs access cost. Shared objects (requiring consensus) cost more than owned objects. |

Key characteristics:
- **Shared objects** (e.g., GlobalConfig, Escrow, QuestRegistry) require consensus ordering and cost ~2-5x more in access fees than owned objects.
- **Dynamic fields / dynamic object fields** each count as a separate object access.
- **Events** have a small but non-zero cost proportional to serialized size.
- **Balance splits and coin transfers** are relatively cheap but each `transfer::public_transfer` is a separate object creation.
- **Vector iteration** costs scale linearly with length; there is no per-loop overhead beyond instruction cost.

---

## crm_core

| Function | Operations | Complexity | Worst-Case Scenario | Risk Level |
|---|---|---|---|---|
| `workspace::create` | 2 object creates (Workspace, MemberRecord), 1 dynamic_object_field add, 1 cap create, 1 event | O(1) | N/A | **Low** |
| `workspace::add_member` | 1 object create (MemberRecord), 1 dynamic_object_field add, 1 event | O(1) | N/A | **Low** |
| `workspace::remove_member` | 1 dynamic_object_field remove, 1 object delete, 1 event | O(1) | N/A | **Low** |
| `workspace::get_member_role` | 1 dynamic_object_field borrow | O(1) | N/A | **Low** |
| `profile::create` | 1 object create, 1 event | O(1) | Large `tags` vector increases storage | **Low** |
| `profile::update_tier_and_score` | Field mutations on owned object | O(1) | N/A | **Low** |
| `profile::archive` | Field mutations, 1 event | O(1) | N/A | **Low** |
| `profile::add_wallet` | 1 object create (WalletBinding), 1 dynamic_object_field add | O(1) | N/A | **Low** |
| `profile::set_metadata` | 1 dynamic_field add/update, 1 event | O(1) | N/A | **Low** |
| `organization::create` | 1 object create, 1 event | O(1) | Large `tags` vector | **Low** |
| `organization::update_name` | Field mutation, 1 event | O(1) | N/A | **Low** |
| `organization::archive` | Field mutation, 1 event | O(1) | N/A | **Low** |
| `organization::set_metadata` | 1 dynamic_field add/update, 1 event | O(1) | N/A | **Low** |
| `relation::create` | 1 object create, 1 event | O(1) | N/A | **Low** |
| `relation::update_type` | Field mutations, 1 event | O(1) | N/A | **Low** |
| `relation::archive` | Field mutations, 1 event | O(1) | N/A | **Low** |
| `deal::create_deal` | 1 object create, 1 event | O(1) | N/A | **Low** |
| `deal::update_deal` | Field mutations, 1 event, `is_valid_transition` (constant-time) | O(1) | N/A | **Low** |
| `deal::archive_deal` | Field mutations, 1 event | O(1) | N/A | **Low** |
| `multi_sig_pause::create_proposal` | 1 object create, `is_voter` linear scan | O(v) where v=voters.length | Large voter list (>100) | **Low** |
| `multi_sig_pause::vote` | `is_voter` x2 linear scans, optional `set_paused` | O(v+s) where v=voters, s=signers | Many voters + signers | **Medium** |
| `admin_recovery::recover_admin_cap` | 1 object create | O(1) | N/A | **Low** |
| `capabilities::check_rate_limit` | Field mutations on owned object | O(1) | N/A | **Low** |
| `capabilities::check_user_rate_limit` | 1 Table lookup/insert | O(1) amortized | Table grows unboundedly per workspace | **Low** |

## crm_data

| Function | Operations | Complexity | Worst-Case Scenario | Risk Level |
|---|---|---|---|---|
| `campaign::create` | 1 object create, 1 event | O(1) | N/A | **Low** |
| `campaign::launch` | Field mutations, 2 events | O(1) | N/A | **Low** |
| `campaign::pause` | Field mutations, 2 events | O(1) | N/A | **Low** |
| `campaign::complete` | Field mutations, 2 events | O(1) | N/A | **Low** |
| `deal::create` | 1 object create, 1 event | O(1) | N/A | **Low** |
| `deal::advance_stage` | Field mutations, 2 events | O(1) | N/A | **Low** |
| `deal::archive` | Field mutations, 1 event | O(1) | N/A | **Low** |
| `segment::create` | 1 object create, 1 event | O(1) | Large `rule_hash` bytes | **Low** |
| `segment::update_rule_hash` | Field mutation, 1 event | O(1) | N/A | **Low** |
| `segment::update_member_count` | Field mutation | O(1) | N/A | **Low** |
| `ticket::create` | 1 object create, 1 event | O(1) | N/A | **Low** |
| `ticket::transition_status` | Field mutations, 2 events | O(1) | N/A | **Low** |
| `ticket::assign` | Field mutation | O(1) | N/A | **Low** |

## crm_escrow

| Function | Operations | Complexity | Worst-Case Scenario | Risk Level |
|---|---|---|---|---|
| `escrow::create_escrow` | 1 shared object create, arbitrator validation loop, 2 events | O(a) where a=arbitrators.length | Many arbitrators (>50) | **Medium** |
| `escrow::fund_escrow` | Balance join, field mutations, 1 event | O(1) | N/A | **Low** |
| `escrow::release` | Balance split, coin create + transfer, field mutations, 1 event | O(1) | N/A | **Low** |
| `escrow::claim_before_expiry` | Balance split, coin create + transfer, field mutations, 1 event | O(1) | N/A | **Low** |
| `escrow::refund` | Balance split, coin create + transfer, field mutations, 1 event | O(1) | N/A | **Low** |
| `escrow::add_vesting` | 1 dynamic_field add (VestingSchedule), milestone validation loop | O(m) where m=milestones.length | Many milestones (>100) | **Medium** |
| `escrow::release_vested` | Dynamic field read, linear/milestone calc, balance split + transfer, 1 event | O(m) for milestone calc | Many milestones | **Low** |
| `escrow::complete_milestone` | Dynamic field borrow_mut, indexed access, 1 event | O(1) | N/A | **Low** |
| `escrow::raise_dispute` | 1 dynamic_field add (ArbitrationState), field mutations, 1 event | O(1) | N/A | **Low** |
| `escrow::vote_on_dispute` | Arbitrator scan O(a), has-voted scan O(a), vote record, threshold check, optional payout + 2 events | O(a) where a=arbitrators | Many arbitrators voting | **Medium** |
| `escrow::commit_vote` | Arbitrator scan O(a), has-voted scan O(a), has-committed scan O(c), push to vectors | O(a+c) | Many arbitrators | **Medium** |
| `escrow::reveal_vote` | `has_committed` scan, `find_commitment_index` scan, keccak256 hash, swap_remove, vote logic + threshold check, optional payout + events | O(a+c) | Many arbitrators + commitments | **Medium** |

## crm_vault

| Function | Operations | Complexity | Worst-Case Scenario | Risk Level |
|---|---|---|---|---|
| `vault::create` | 1 object create, 1 event | O(1) | N/A | **Low** |
| `vault::set_blob` | Field mutations, 1 event | O(1) | N/A | **Low** |
| `vault::archive` | Field mutations, 1 event | O(1) | N/A | **Low** |
| `policy::create_workspace_policy` | 1 object create, 1 event | O(1) | N/A | **Low** |
| `policy::create_address_policy` | 1 object create (stores address vector), 1 event | O(1) | Large `allowed_addresses` vector | **Low** |
| `policy::create_role_policy` | 1 object create, 1 event | O(1) | N/A | **Low** |
| `policy::add_address` | Vector push_back, 1 event | O(1) amortized | Unbounded address list growth | **Low** |
| `policy::seal_approve` (entry) | `vector::contains` linear scan, address comparison | O(n) where n=allowed_addresses | Large allow-list (>1000 addresses) | **Medium** |

## crm_action

| Function | Operations | Complexity | Worst-Case Scenario | Risk Level |
|---|---|---|---|---|
| `airdrop::batch_airdrop` | Loop: coin split + public_transfer per recipient, remainder handling, 2 events | O(n) where n=recipients | 1000+ recipients | **High** |
| `airdrop::batch_airdrop_variable` | Loop: coin split + public_transfer per recipient, sum calc, remainder handling, 1 event | O(n) where n=recipients | 1000+ recipients | **High** |
| `reward::distribute` | 1 coin split + transfer, 1 RewardRecord object create + transfer, 2 events | O(1) | N/A | **Low** |
| `reward::batch_distribute` | Loop: coin split + public_transfer per recipient, remainder handling, 1 event | O(n) where n=recipients | 1000+ recipients | **High** |
| `quest_badge::mint_badge` | Table lookup + insert, 1 object create (SBT), BCS serialization for dedup key, transfer, 2 events | O(1) amortized | Table grows unboundedly | **Low** |

---

## Gas Optimization Recommendations

### 1. Airdrop / Batch Distribute -- Add Recipient Cap

**Affected:** `airdrop::batch_airdrop`, `airdrop::batch_airdrop_variable`, `reward::batch_distribute`

These functions iterate over an unbounded `recipients` vector. Each iteration performs a `coin::split` (new Coin object creation) and `transfer::public_transfer` (ownership assignment). For n=1000 recipients, this means ~1000 new objects created in a single transaction.

**Recommendation:** Add a compile-time or runtime cap (e.g., `MAX_RECIPIENTS = 500`) and require callers to batch across multiple transactions. This prevents a single TX from exceeding the gas budget.

```move
const MAX_BATCH_SIZE: u64 = 500;
assert!(recipient_count <= MAX_BATCH_SIZE, ETooManyRecipients);
```

### 2. Arbitrator Vector Scans -- Use Table for Large Sets

**Affected:** `escrow::vote_on_dispute`, `escrow::commit_vote`, `escrow::reveal_vote`

The `is_arb` check iterates the entire `arbitrators` vector, and `arb_has_voted` iterates both `votes_release` and `votes_refund`. For 10+ arbitrators these are fine, but the pattern does not scale.

**Recommendation:** For current use (3-7 arbitrators), the vector approach is acceptable. If arbitrator counts grow beyond ~20, consider using a `Table<address, bool>` for O(1) membership checks.

### 3. Seal Approve Address Scan

**Affected:** `policy::seal_approve`

Uses `vector::contains` to check if the caller is in `allowed_addresses`. For policies with many allowed addresses, this is O(n).

**Recommendation:** For large address lists (>100), consider a `Table<address, bool>` in the AccessPolicy struct. For typical use (<20 addresses), the current approach is fine.

### 4. PerUserRateLimit Table Growth

**Affected:** `capabilities::check_user_rate_limit`

The `PerUserRateLimit.limits` table grows monotonically -- entries are never removed. Over time, this increases storage costs for the shared object.

**Recommendation:** Consider adding a cleanup function or epoch-based pruning to remove stale entries.

### 5. QuestRegistry Table Growth

**Affected:** `quest_badge::mint_badge`

The shared `QuestRegistry.minted` table grows unboundedly. Each mint adds a new entry that is never removed.

**Recommendation:** Acceptable for the dedup use case (entries must persist forever). Monitor storage costs over time.

---

## DoS Risk Assessment

### HIGH RISK

| Vector | Function | Attack Description | Mitigation |
|---|---|---|---|
| **Unbounded batch size** | `airdrop::batch_airdrop`, `batch_airdrop_variable`, `reward::batch_distribute` | Attacker with admin cap submits 10,000+ recipients, causing TX to exceed gas budget or block processing time. | **Add MAX_BATCH_SIZE constant.** Currently NO cap exists. |

### MEDIUM RISK

| Vector | Function | Attack Description | Mitigation |
|---|---|---|---|
| **Arbitrator count** | `escrow::create_escrow` | Large arbitrator vector (100+) increases create cost and all subsequent vote/commit/reveal operations. | Add `MAX_ARBITRATORS` constant (e.g., 21). |
| **Vote scanning** | `escrow::vote_on_dispute`, `commit_vote`, `reveal_vote` | Each vote operation scans arbitrators + vote vectors. With many arbitrators + votes, gas grows quadratically across all votes. | Bounded by arbitrator count; add cap as above. |
| **Address policy growth** | `policy::add_address` | Repeated calls grow `allowed_addresses` unboundedly, making `seal_approve` increasingly expensive. | Add `MAX_ALLOWED_ADDRESSES` or use Table. |

### LOW RISK

| Vector | Function | Attack Description | Mitigation |
|---|---|---|---|
| **Voter list in multi_sig_pause** | `multi_sig_pause::create_proposal`, `vote` | Large voter list increases scan time per vote. | Practically limited to small governance groups. |
| **Tags vector** | `profile::create`, `organization::create` | Large tags vector increases storage cost. | Add max tags limit off-chain in BFF. |
| **Milestone count** | `escrow::add_vesting` | Many milestones increase validation + subsequent release_vested calc. | Add `MAX_MILESTONES` constant. |
| **Table growth** | `capabilities::check_user_rate_limit`, `quest_badge::mint_badge` | Monotonically growing tables increase shared object size. | Monitor; add cleanup for rate limits. |

### NOT A RISK

| Function | Reason |
|---|---|
| All CRUD operations (create/update/archive) in core/data/vault | O(1) operations on owned objects. Gas is bounded and predictable. |
| `escrow::release`, `fund_escrow`, `refund` | O(1) balance operations. |
| `escrow::complete_milestone` | O(1) indexed access. |

---

## Storage Cost Summary

| Object Type | Created By | Shared? | Approx Fields | Notes |
|---|---|---|---|---|
| Workspace | `workspace::create` | Yes (implicit via `key`) | 5 | Plus dynamic_object_fields for members |
| WorkspaceAdminCap | `workspace::create` | No (owned) | 2 | Lightweight capability |
| GlobalConfig | `capabilities::init` | Yes | 3 | Singleton |
| RateLimitConfig | `capabilities::create_rate_limit` | Depends on usage | 5 | Per-workspace |
| PerUserRateLimit | `capabilities::create_per_user_rate_limit` | Depends on usage | 4 + Table | Table grows per unique user |
| Profile | `profile::create` | No (owned) | 14 | Plus dynamic fields for wallets/metadata |
| WalletBinding | `profile::add_wallet` | No (DOF on Profile) | 5 | One per wallet |
| Organization | `organization::create` | No (owned) | 12 | Plus optional dynamic fields |
| Relation | `relation::create` | No (owned) | 11 | Lightweight link object |
| Deal (core) | `deal::create_deal` | No (owned) | 12 | |
| Deal (data) | `deal::create` | No (owned) | 14 | Extended deal model |
| Campaign | `campaign::create` | No (owned) | 11 | |
| Segment | `segment::create` | No (owned) | 8 | `rule_hash` can be large |
| Ticket | `ticket::create` | No (owned) | 13 | |
| Escrow | `escrow::create_escrow` | Yes (shared) | 16 + vectors | Plus optional VestingSchedule + ArbitrationState as dynamic fields |
| VestingSchedule | `escrow::add_vesting` | No (DF on Escrow) | 5 + milestones vector | |
| ArbitrationState | `escrow::raise_dispute` | No (DF on Escrow) | 7 + vote vectors | Grows with each vote/commit |
| Vault | `vault::create` | No (owned) | 14 | |
| AccessPolicy | `policy::create_*` | No (owned) | 9 + addresses vector | |
| QuestBadge | `quest_badge::mint_badge` | No (owned, SBT) | 9 | Non-transferable |
| QuestRegistry | `quest_badge::init` | Yes (shared) | 2 + Table | Table grows per mint |
| RewardRecord | `reward::distribute` | No (owned) | 7 | One per distribution |
| PauseProposal | `multi_sig_pause::create_proposal` | Depends on usage | 6 + vectors | |
