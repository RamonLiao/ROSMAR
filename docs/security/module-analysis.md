# Module Security Analysis — ROSMAR CRM (P5 Security Audit)

Generated: 2026-03-10

---

## Package: `crm_core`

### Module: `capabilities`

1. **Purpose** — Provides the global pause switch (`GlobalConfig`), workspace-scoped admin capabilities (`WorkspaceAdminCap`), emergency pause (`EmergencyPauseCap`), and rate limiting (per-workspace and per-user).

2. **Key Invariants**
   - `GlobalConfig` is a shared object created at module init; exactly one instance exists.
   - `EmergencyPauseCap` is transferred to the deployer at init; only the holder can directly pause/unpause.
   - `WorkspaceAdminCap.workspace_id` is immutable after creation; `assert_cap_matches` guarantees workspace isolation.
   - Per-user rate limit resets every epoch; `count < max_per_epoch` is enforced before increment.

3. **Known Risks**
   - If `EmergencyPauseCap` is lost or transferred to a malicious party, the single-holder pause mechanism is compromised. Mitigated by M4 (multi-sig pause).
   - `create_admin_cap` is `public` — any module in the ecosystem can mint caps. Currently only called by `workspace::create` and `admin_recovery::recover_admin_cap`, but a malicious dependent package could mint arbitrary caps.
   - Rate limit `Table` growth is unbounded per workspace; a workspace with millions of unique users would grow the table indefinitely (no eviction).

4. **Mitigations Applied**
   - **M7** (b3defd6): Added `PerUserRateLimit` with per-epoch tracking and `EUserRateLimitExceeded` abort.
   - **M4** (0f141e3): Added `set_paused(public(package))` for multi-sig pause integration, keeping the function package-internal.

5. **Test Coverage**
   - `crm_core::red_team_tests::red_team_mass_add_member_dos` — verifies per-user rate limit enforcement.
   - `crm_core::red_team_tests::red_team_pause_bypass` — verifies EPaused abort on profile creation.

6. **Remaining Concerns**
   - `create_admin_cap` being `public` (not `public(package)`) is a design risk if third-party packages depend on `crm_core`. Consider restricting to `public(package)` or adding a friend-only gate.
   - No mechanism to revoke/burn a `WorkspaceAdminCap` on-chain; cap rotation depends on Sui object ownership rules.
   - Per-user rate limit Table has no cleanup/eviction for stale entries.

---

### Module: `workspace`

1. **Purpose** — Manages workspace creation, member addition/removal with role assignment. Members are stored as dynamic object fields keyed by address for O(1) lookup.

2. **Key Invariants**
   - Workspace owner is set at creation and cannot be changed on-chain.
   - Owner cannot be removed (`assert!(member_address != workspace.owner, ENotOwner)`).
   - `member_count` is always consistent with the number of dynamic object fields (add increments, remove decrements).
   - All mutating functions require `GlobalConfig` pause check + `WorkspaceAdminCap` match.

3. **Known Risks**
   - No upper bound on `member_count`; a workspace can add unlimited members (gas-limited only).
   - `add_member` allows adding any address without that address's consent.
   - Role assigned at `add_member` is immutable — there's no `update_member_role` function.

4. **Mitigations Applied**
   - Pause check on all mutating functions.
   - Cross-workspace cap attacks blocked by `assert_cap_matches`.

5. **Test Coverage**
   - `crm_core::red_team_tests::red_team_cross_workspace_cap_attack` — verifies ECapMismatch on cross-workspace profile creation (exercises workspace cap validation indirectly).

6. **Remaining Concerns**
   - No `update_member_role` function — role changes require remove + re-add, which loses the `joined_at` timestamp.
   - No event emitted for workspace creation failure (expected, since aborts revert).

---

### Module: `profile`

1. **Purpose** — CRM contact profiles with wallet bindings, metadata (dynamic fields), and soft-archive. Supports optimistic concurrency via version field.

2. **Key Invariants**
   - Profile `workspace_id` is immutable after creation.
   - Version is monotonically increasing (incremented on every mutation).
   - Archived profiles cannot be re-archived (`EAlreadyArchived`).
   - `add_wallet` requires cap check + workspace match (P5 fix M1).

3. **Known Risks**
   - `update_tier_and_score` has NO cap check — anyone with `&mut Profile` can modify tier/score. This is by design (called from other modules) but exposes risk if Profile objects are shared.
   - `set_metadata<V>` type parameter: overwriting a key with a different type V causes a Move dynamic_field type mismatch abort, but the error is opaque.
   - No validation on `primary_address` — could be set to an arbitrary address.

4. **Mitigations Applied**
   - **M1** (f1fcfc2): Cap check added to `add_wallet` — previously allowed unchecked wallet binding.

5. **Test Coverage**
   - `crm_core::red_team_tests::red_team_cross_workspace_object_manipulation` — verifies EWorkspaceMismatch when archiving profile from wrong workspace.
   - `crm_core::red_team_tests::red_team_type_confusion_metadata` — verifies type mismatch abort on dynamic field overwrite.

6. **Remaining Concerns**
   - `update_tier_and_score` lacks any access control; if Profile is ever made a shared object, anyone could mutate it.
   - No `unarchive` function — archived profiles are permanently soft-deleted on-chain.

---

### Module: `deal` (crm_core)

1. **Purpose** — Manages deal pipeline with 6-stage FSM (Lead -> Qualified -> Proposal -> Negotiation -> Won/Lost). Supports optimistic concurrency and soft-archive.

2. **Key Invariants**
   - Stage transitions are strictly validated: forward-only by one step, any non-terminal to Lost, no exit from Won/Lost, same-stage no-op allowed.
   - Version increments on every mutation; concurrent edits abort with `EVersionConflict`.
   - Archived deals reject all further mutations.

3. **Known Risks**
   - `is_valid_transition` allows skipping directly to Lost from any non-terminal stage — intentional but allows deal abandonment without negotiation.
   - No amount validation (amount_usd can be 0 or u64::MAX).

4. **Mitigations Applied**
   - **M2** (47542d0): Added `is_valid_transition` check to `update_deal` — previously allowed arbitrary stage jumps.

5. **Test Coverage**
   - Core deal tests cover happy-path stage transitions.
   - Red team tests in `crm_data` cover `EAlreadyArchived` on archived deals (sibling deal module).

6. **Remaining Concerns**
   - `amount_usd = 0` is allowed on creation — may need business-level validation.
   - Stage transition allows same-stage (no-op) which still bumps version and emits event — potential event spam.

---

### Module: `relation`

1. **Purpose** — Links profiles to organizations with typed relationships (Member-of, Partner, Investor, Advisor). Supports optimistic concurrency and soft-archive.

2. **Key Invariants**
   - All mutations require pause check + cap match + workspace match + version match.
   - Archived relations reject further mutations.

3. **Known Risks**
   - No validation that `profile_id` and `organization_id` actually exist or belong to the same workspace — referential integrity is assumed off-chain.
   - `relation_type` is unchecked — values outside 0-3 are accepted.

4. **Mitigations Applied**
   - Standard cap/workspace/version checks applied consistently.

5. **Test Coverage**
   - Indirectly covered by core module tests. No dedicated red team test for `relation`.

6. **Remaining Concerns**
   - Missing `relation_type` range validation (should assert type <= RELATION_ADVISOR).
   - No unique constraint preventing duplicate relations between the same profile-org pair.

---

### Module: `organization`

1. **Purpose** — Workspace-scoped organization entities with metadata (dynamic fields), optimistic concurrency, and soft-archive.

2. **Key Invariants**
   - Same pattern as profile: cap check + workspace match + version check on all mutations.
   - Archived organizations reject further mutations.

3. **Known Risks**
   - Same type confusion risk as profile's `set_metadata<V>`.
   - No limit on number of dynamic field metadata entries.

4. **Mitigations Applied**
   - Consistent security pattern across all CRUD modules.

5. **Test Coverage**
   - No dedicated red team test for organization module specifically. Cross-workspace tests cover the cap/workspace isolation pattern.

6. **Remaining Concerns**
   - Same as profile: `set_metadata` type parameter edge case produces opaque error.

---

### Module: `acl`

1. **Purpose** — Permission bitmask system with predefined roles (Viewer, Member, Admin, Owner) and permission constants (Read, Write, Share, Delete, Manage).

2. **Key Invariants**
   - `admin()` and `owner()` both have permission bitmask 31 (all permissions).
   - `assert_permission` aborts with `EInsufficientPermission` if bitmask check fails.
   - Role is a value type (`store, copy, drop`) — cannot be forged without calling constructors.

3. **Known Risks**
   - `custom_role(level, permissions)` is `public` — any caller can construct an arbitrary role with any permissions. This is by design for flexibility but means role validation must happen at the point of use (e.g., workspace membership).
   - Permission checks are not applied on-chain in most modules — they rely on BFF enforcement.

4. **Mitigations Applied**
   - Standard Sui type safety prevents role forgery at the object level.

5. **Test Coverage**
   - Implicitly tested via workspace member operations.

6. **Remaining Concerns**
   - On-chain permission enforcement is limited; most role checks are BFF-side. A direct on-chain caller with a `WorkspaceAdminCap` bypasses role-level restrictions.

---

### Module: `admin_recovery`

1. **Purpose** — Allows the workspace owner to recover a new `WorkspaceAdminCap` if the original is lost, without needing the old cap.

2. **Key Invariants**
   - Only `workspace.owner` (checked via `ctx.sender()`) can recover a cap.
   - Pause check is enforced — no recovery during system pause.
   - Returns a new cap; the old cap (if it still exists) remains valid.

3. **Known Risks**
   - Does not invalidate the old cap — if the old cap was stolen (not lost), the attacker retains it.
   - Owner address is immutable in the Workspace struct — if the owner wallet is compromised, recovery doesn't help.

4. **Mitigations Applied**
   - **M3** (0f141e3): This module was added as a P5 security fix to address cap loss scenarios.

5. **Test Coverage**
   - `crm_core::red_team_tests::red_team_non_owner_admin_recovery` — verifies ENotWorkspaceOwner when non-owner attempts recovery.

6. **Remaining Concerns**
   - No cap revocation mechanism — recovered cap coexists with any previous caps.
   - Consider adding a workspace owner transfer function for compromised-wallet scenarios.

---

### Module: `multi_sig_pause`

1. **Purpose** — Multi-signature proposal system for pausing/unpausing the global system. Requires threshold-of-N votes from a predefined voter list.

2. **Key Invariants**
   - Threshold must be >= 1 and <= voter count.
   - Each voter can vote exactly once (double-vote check).
   - Proposal creator must be in the voters list.
   - Once resolved, no more votes accepted (`EAlreadyResolved`).
   - Uses `capabilities::set_paused(public(package))` — only callable from within `crm_core`.

3. **Known Risks**
   - Voter list is fixed at proposal creation — no way to add/remove voters after creation.
   - `PauseProposal` is a standalone object — anyone with the object ID can reference it, but only authorized voters can act.
   - Linear scan for voter lookup (O(n)) — acceptable for small voter sets but inefficient for large sets.

4. **Mitigations Applied**
   - **M4** (0f141e3): This module was added as a P5 security fix to replace single-key pause with multi-sig governance.

5. **Test Coverage**
   - No dedicated red team test for multi_sig_pause. Core tests cover happy-path voting.

6. **Remaining Concerns**
   - No expiry on proposals — a stale proposal with 1 remaining vote could be resolved long after creation.
   - No event emission on vote or resolution — harder to index off-chain.

---

## Package: `crm_data`

### Module: `campaign`

1. **Purpose** — Campaign lifecycle management with FSM (Draft -> Active <-> Paused -> Completed). Linked to segments for audience targeting.

2. **Key Invariants**
   - Status transitions are strictly validated: Draft/Paused -> Active, Active -> Paused, Active -> Completed.
   - Completed is terminal — no transitions out.
   - `start_time` set on launch, `end_time` set on complete.

3. **Known Risks**
   - No transition from Paused -> Completed (must go Active first) — could be a UX limitation.
   - `segment_id` is not validated to exist or belong to the same workspace.

4. **Mitigations Applied**
   - Standard cap/workspace/pause checks.

5. **Test Coverage**
   - `crm_data::red_team_tests::test_campaign_draft_to_completed` — verifies EInvalidTransition for Draft -> Completed bypass.
   - `crm_action::red_team_tests::test_reward_distribute_draft_campaign` — verifies ECampaignNotActive for distributing rewards to draft campaigns.

6. **Remaining Concerns**
   - No mechanism to delete/archive a campaign (only status transitions).
   - Completed campaigns remain mutable in theory (no `is_archived` flag).

---

### Module: `deal` (crm_data)

1. **Purpose** — Extended deal model with richer stage pipeline (New -> Qualified -> Proposal -> Won/Lost) and direct stage advancement. Includes DealStageChanged event.

2. **Key Invariants**
   - Stage transitions validated by `is_valid_transition`: forward pipeline + skip-to-terminal from any non-terminal stage.
   - Archived deals reject `advance_stage` (`EAlreadyArchived`).
   - Optimistic concurrency via version field.

3. **Known Risks**
   - `is_valid_transition` allows `STAGE_NEW -> STAGE_WON` directly (skip Qualified, Proposal) via the "skip to won/lost from any non-terminal" rule. This may be too permissive.
   - `value` field (monetary amount) has no validation.

4. **Mitigations Applied**
   - Standard cap/workspace/version/archive checks.

5. **Test Coverage**
   - `crm_data::red_team_tests::test_deal_archive_then_advance` — verifies EAlreadyArchived blocks post-archive stage changes.

6. **Remaining Concerns**
   - Direct NEW -> WON jump may need business justification or restriction.
   - No stage revert mechanism (once WON/LOST, it's terminal).

---

### Module: `segment`

1. **Purpose** — Audience segments with rule hashes for off-chain rule evaluation. Supports dynamic vs. static membership and cached member counts.

2. **Key Invariants**
   - Rule hash and member count updates require cap + workspace + version checks.
   - `update_member_count` does NOT require version check (by design, for frequent background updates) but does require cap + workspace match.

3. **Known Risks**
   - `update_member_count` lacks version check — concurrent updates could produce stale counts.
   - `rule_hash` is opaque bytes — no on-chain validation of rule semantics.

4. **Mitigations Applied**
   - Standard cap/workspace/pause checks.

5. **Test Coverage**
   - `crm_data::red_team_tests::test_segment_cross_workspace_update` — verifies EWorkspaceMismatch on cross-workspace rule hash update.

6. **Remaining Concerns**
   - `update_member_count` without version check could cause off-by-one in concurrent scenarios.
   - No archive/delete mechanism for segments.

---

### Module: `ticket`

1. **Purpose** — Support ticket system with 5-status FSM (Open -> InProgress <-> Waiting -> Resolved <-> InProgress, Resolved -> Closed). Tracks SLA, first response, and resolution timestamps.

2. **Key Invariants**
   - Status transitions strictly validated by `is_valid_transition`.
   - Closed is terminal — no transitions out.
   - `first_response_at` set on Open -> InProgress; `resolved_at` set on any transition to Resolved.

3. **Known Risks**
   - `priority` field has no range validation (any u8 accepted, not just 0-3).
   - `assign` does not validate the assignee is a workspace member.
   - Re-resolving after reopen (Resolved -> InProgress -> Resolved) overwrites `resolved_at`.

4. **Mitigations Applied**
   - Standard cap/workspace/pause/version checks.

5. **Test Coverage**
   - `crm_data::red_team_tests::test_ticket_reclose_after_closed` — verifies EInvalidTransition for Closed -> any.

6. **Remaining Concerns**
   - Missing priority range validation.
   - No SLA breach detection on-chain (purely informational timestamp).
   - No archive mechanism for tickets.

---

## Package: `crm_escrow`

### Module: `escrow`

1. **Purpose** — Full escrow system with SUI coin custody, linear/milestone vesting, dispute arbitration (direct vote + commit-reveal), expiry-based refunds, and payee claim windows.

2. **Key Invariants**
   - `balance >= 0` at all times (enforced by `Balance<SUI>` type).
   - `released_amount + refunded_amount + balance_value == total_funded` (accounting identity).
   - State machine: CREATED -> FUNDED -> PARTIALLY_RELEASED/COMPLETED/REFUNDED/DISPUTED.
   - Payer is the only one who can release, refund (pre-expiry), add vesting, complete milestones.
   - Payee can only `claim_before_expiry` within the 24h window.
   - Arbitrators can only vote on DISPUTED escrows, once per arbitrator.
   - Min lock duration (1 hour) enforced on creation (expiry) and release (funded_at).
   - Milestone percentages must sum to exactly 10000 basis points.
   - Commit-reveal: hash = keccak256(vote_byte || salt), reveal must happen before deadline.

3. **Known Risks**
   - `release(amount=0)` is NOT explicitly blocked — `balance::split(0)` succeeds in Move, creating a zero-value coin. State would transition but release 0 tokens.
   - After a dispute is resolved (funds distributed), the escrow object persists as a shared object with 0 balance — no cleanup mechanism.
   - Commit-reveal deadline is set per-commitment (latest wins) — a late committer can extend the deadline for all.
   - `refund` with `is_funded_no_expiry` allows payer to refund a funded escrow at any time if no expiry was set — payee has no protection without expiry.
   - Arbitrator independence: no on-chain check that arbitrators are unrelated to the deal parties (beyond payer/payee exclusion).
   - `complete_milestone` does not check if milestone is already completed — double-completing is a no-op but emits a duplicate event.
   - Vesting `start_time` is set from Clock at `add_vesting` call, not at funding time — gap between funding and vesting setup is not accounted for.

4. **Mitigations Applied**
   - **M5** (0f141e3): Added `claim_before_expiry` — payee can claim remaining balance within 24h window before expiry, preventing payer from running out the clock.
   - **M6** (c595ea6): Added `commit_vote` + `reveal_vote` with keccak256 hash verification for commit-reveal arbitration voting, preventing vote-copying attacks.

5. **Test Coverage**
   - `crm_escrow::red_team_tests::red_team_release_zero_amount` — verifies EOverRelease when release_vested yields 0 (but only for vested path, not direct release).
   - `crm_escrow::red_team_tests::red_team_release_exceeds_balance` — verifies EOverRelease when release > balance.
   - `crm_escrow::red_team_tests::red_team_milestone_overflow_bp` — verifies EMilestonePercentageMismatch for > 10000bp.
   - `crm_escrow::red_team_tests::red_team_refund_funded_before_expiry` — verifies EInvalidStateTransition for premature refund with expiry.
   - `crm_escrow::red_team_tests::red_team_double_vote` — verifies EAlreadyVoted for double arbitrator vote.
   - `crm_escrow::red_team_tests::red_team_release_before_cliff` — verifies EOverRelease for pre-cliff release.
   - `crm_escrow::red_team_tests::red_team_claim_outside_window` — verifies ENotInClaimWindow for claim outside 24h window.
   - `crm_escrow::red_team_tests::red_team_non_arbitrator_vote` — verifies ENotArbitrator for unauthorized voter.

6. **Remaining Concerns**
   - **`release(amount=0)` accepted** — should add `assert!(amount > 0, ...)` to prevent zero-value releases that transition state without moving funds.
   - **No escrow cleanup** — completed/refunded escrows remain as shared objects forever.
   - **Commit-reveal deadline extension** — last committer controls the reveal window for all arbitrators.
   - **No-expiry funded escrow** — payer can refund at any time, leaving payee unprotected. Consider requiring expiry for funded escrows.

---

### Module: `arbitration`

1. **Purpose** — Pure constant module defining DECISION_RELEASE (0) and DECISION_REFUND (1) constants.

2. **Key Invariants** — Constants are immutable.

3. **Known Risks** — None; this is a stateless constant module.

4. **Mitigations Applied** — N/A.

5. **Test Coverage** — Used throughout escrow tests.

6. **Remaining Concerns** — None.

---

### Module: `vesting`

1. **Purpose** — Pure math module for linear and milestone vesting calculations. Uses u128 intermediate arithmetic to prevent overflow.

2. **Key Invariants**
   - `calc_linear_vested`: returns `total` if elapsed >= duration; uses u128 multiplication to avoid overflow.
   - `calc_milestone_vested_from_bp`: proportional calculation using basis points with u128 intermediate.
   - `BASIS_POINTS_TOTAL = 10000`.

3. **Known Risks**
   - Integer truncation: `(u128 as u64)` truncates — but since inputs are u64, the result fits.
   - `duration_ms = 0` would cause division by zero in `calc_linear_vested` — but the `elapsed >= duration` check (0 >= 0) returns total first.

4. **Mitigations Applied** — u128 intermediate math prevents overflow for realistic values.

5. **Test Coverage** — Implicitly tested via escrow vesting tests.

6. **Remaining Concerns**
   - No explicit test for edge case `duration_ms = 0` (safe due to early return, but worth testing).

---

## Package: `crm_vault`

### Module: `vault`

1. **Purpose** — On-chain metadata for encrypted documents stored on Walrus. Links workspace profiles to blob IDs with Seal access policies.

2. **Key Invariants**
   - Vault `workspace_id` immutable after creation.
   - Archived vaults reject `set_blob` (`EAlreadyArchived`).
   - Optimistic concurrency via version field.

3. **Known Risks**
   - `walrus_blob_id` and `seal_policy_id` are opaque IDs — no on-chain validation they exist.
   - `size_bytes` is self-reported; actual blob size is validated by Walrus.
   - `vault_type` is unchecked (any u8, not just 0-1).

4. **Mitigations Applied**
   - Standard cap/workspace/version/pause/archive checks.

5. **Test Coverage**
   - `crm_vault::red_team_tests::test_cross_workspace_vault_archive` — verifies EWorkspaceMismatch for cross-workspace vault archive.
   - `crm_vault::red_team_tests::test_archived_vault_set_blob` — verifies EAlreadyArchived for mutation after archive.

6. **Remaining Concerns**
   - Missing `vault_type` range validation.
   - No mechanism to update `owner_profile_id` after creation.

---

### Module: `policy`

1. **Purpose** — Seal key-server access policies. Three rule types: workspace member (implicit), specific address list, role-based (minimum level). `seal_approve` entry function for key-server verification.

2. **Key Invariants**
   - `seal_approve` checks `id` parameter matches policy object address (prevents cross-policy replay).
   - RULE_SPECIFIC_ADDRESS: sender must be in `allowed_addresses`.
   - RULE_WORKSPACE_MEMBER and RULE_ROLE_BASED: on-chain enforcement is relaxed; BFF handles membership/role verification.

3. **Known Risks**
   - **RULE_WORKSPACE_MEMBER allows ALL callers on-chain** — workspace membership is enforced off-chain by BFF. A direct on-chain caller bypasses this check.
   - **RULE_ROLE_BASED allows ALL callers on-chain** — same issue, role check is BFF-only.
   - `add_address` does not check for duplicate addresses in the list.
   - No `remove_address` function — once an address is added, it can only be "removed" by creating a new policy.

4. **Mitigations Applied**
   - Anti-replay via `id == policy_addr` check in `seal_approve`.
   - Address-list policies provide strong on-chain enforcement.

5. **Test Coverage**
   - `crm_vault::red_team_tests::test_seal_approve_wrong_id` — verifies ESealInvalidIdentity for mismatched policy ID.

6. **Remaining Concerns**
   - **Critical**: WORKSPACE_MEMBER and ROLE_BASED policies have no on-chain enforcement — anyone who can call `seal_approve` directly gets access. Mitigation depends entirely on Seal key-server integration with BFF.
   - No `remove_address` function for address-list policies.
   - Duplicate addresses in `allowed_addresses` are not prevented.

---

## Package: `crm_action`

### Module: `airdrop`

1. **Purpose** — Batch SUI distribution to recipient lists (equal or variable amounts). Returns remaining funds to sender.

2. **Key Invariants**
   - Recipients list must be non-empty.
   - Fund coin must cover total distribution amount.
   - Remaining balance returned to sender after distribution.

3. **Known Risks**
   - No upper bound on recipients count — gas limit is the only constraint. Very large lists could fail due to gas.
   - `batch_airdrop_variable` does not pre-validate total sum fits in fund — fails mid-execution if fund runs out during iteration.
   - Potential integer overflow: `amount_per_recipient * recipient_count` could overflow u64 for large values.

4. **Mitigations Applied**
   - Standard cap/workspace/pause checks.

5. **Test Coverage**
   - `crm_action::red_team_tests::test_airdrop_empty_recipients` — verifies EEmptyRecipients for empty list.
   - `crm_action::red_team_tests::test_airdrop_insufficient_funds` — verifies EInsufficientFunds for underfunded airdrop.

6. **Remaining Concerns**
   - **Integer overflow**: `amount_per_recipient * recipient_count` overflows for large values (e.g., 10^18 * 10^4). Should use checked multiplication or u128.
   - `batch_airdrop_variable` fails mid-execution if fund runs dry, leaving partial distributions — should pre-validate total.
   - No deduplication on recipient list — same address can receive multiple payments.

---

### Module: `reward`

1. **Purpose** — Campaign-linked SUI reward distribution (single and batch). Creates `RewardRecord` objects for audit trail.

2. **Key Invariants**
   - Campaign must be in ACTIVE status (`status_active()`).
   - Campaign must belong to the same workspace.
   - Fund must cover the reward amount.
   - `RewardRecord` is transferred to sender (admin), not the recipient.

3. **Known Risks**
   - Same integer overflow risk as airdrop for `batch_distribute`.
   - `batch_distribute` does NOT create individual `RewardRecord` objects — only emits a single aggregated event. Audit trail is weaker for batch.
   - No per-recipient cap or total campaign budget enforcement on-chain.

4. **Mitigations Applied**
   - Campaign status check ensures rewards only flow during active campaigns.

5. **Test Coverage**
   - `crm_action::red_team_tests::test_reward_distribute_draft_campaign` — verifies ECampaignNotActive for DRAFT campaign reward distribution.

6. **Remaining Concerns**
   - Missing individual reward records for `batch_distribute`.
   - No on-chain campaign budget cap — unlimited rewards can be distributed to an active campaign.

---

### Module: `quest_badge`

1. **Purpose** — Soul-bound (non-transferable) NFT badges for quest completion. Uses `QuestRegistry` shared object for deduplication. Display metadata via Sui Display standard.

2. **Key Invariants**
   - `QuestBadge` has `key` but NOT `store` — cannot be transferred after minting (SBT).
   - Deduplication via BCS-serialized `quest_id + recipient` key in registry Table.
   - Exactly one `QuestRegistry` created at module init.

3. **Known Risks**
   - `QuestRegistry.minted` Table grows indefinitely — no pruning mechanism.
   - `completed_steps` and `total_steps` are not validated (`completed_steps > total_steps` is allowed).
   - Display URLs are hardcoded to `crm.rosmar.io` — non-configurable after deployment.

4. **Mitigations Applied**
   - SBT design (no `store` ability) prevents secondary market trading.
   - Dedup registry prevents double-minting.

5. **Test Coverage**
   - No dedicated red team test for quest_badge. Core tests cover happy-path minting.

6. **Remaining Concerns**
   - Missing `completed_steps <= total_steps` validation.
   - Registry Table growth is unbounded.
   - No burn/revoke mechanism for badges (soul-bound means permanent).

---

## Cross-Cutting Concerns

### Consistent Security Patterns

All domain modules (profile, organization, deal, relation, campaign, segment, ticket, vault, policy) follow the same pattern:
1. `capabilities::assert_not_paused(config)` — global pause check
2. `capabilities::assert_cap_matches(cap, workspace_id)` — workspace isolation
3. `assert!(obj.workspace_id == workspace_id, EWorkspaceMismatch)` — object ownership verification
4. `assert!(obj.version == expected_version, EVersionConflict)` — optimistic concurrency
5. `assert!(!obj.is_archived, EAlreadyArchived)` — soft-delete protection

### P5 Security Fixes Summary

| ID | Fix | Commit | Module | Impact |
|---|---|---|---|---|
| M1 | Cap check on `profile::add_wallet` | f1fcfc2 | crm_core::profile | Prevents unchecked wallet binding from unauthorized callers |
| M2 | Stage transition validation in `deal::update_deal` | 47542d0 | crm_core::deal | Prevents arbitrary stage jumps bypassing pipeline |
| M3 | Admin recovery module | 0f141e3 | crm_core::admin_recovery | Enables cap recovery without compromising security |
| M4 | Multi-sig pause mechanism | 0f141e3 | crm_core::multi_sig_pause | Replaces single-key pause with threshold governance |
| M5 | Payee claim before expiry | 0f141e3 | crm_escrow::escrow | Protects payee from payer running out the clock |
| M6 | Commit-reveal arbitration | c595ea6 | crm_escrow::escrow | Prevents vote-copying in dispute resolution |
| M7 | Per-user rate limiting | b3defd6 | crm_core::capabilities | Prevents per-user DoS/spam attacks |
| B1-B9 | BFF security fixes | Various | packages/bff | JWT hardening, RBAC, input validation, rate limiting, CORS, etc. |

### Red Team Test Coverage Matrix

| Package | Test File | Tests | Attack Vectors Covered |
|---|---|---|---|
| crm_core | `tests/red_team_tests.move` | 6 | Cross-workspace cap, non-owner recovery, cross-workspace object mutation, per-user DoS, type confusion metadata, pause bypass |
| crm_escrow | `tests/red_team_tests.move` | 8 | Zero-amount release, over-balance release, milestone BP overflow, premature refund, double vote, pre-cliff release, claim outside window, non-arbitrator vote |
| crm_action | `tests/red_team_tests.move` | 3 | Empty recipients airdrop, insufficient funds, draft campaign reward |
| crm_data | `tests/red_team_tests.move` | 4 | Invalid campaign transition, ticket re-close, cross-workspace segment update, archived deal advance |
| crm_vault | `tests/red_team_tests.move` | 3 | Seal approve wrong ID, cross-workspace vault archive, archived vault mutation |

**Total: 24 red team tests covering the primary attack surface.**
