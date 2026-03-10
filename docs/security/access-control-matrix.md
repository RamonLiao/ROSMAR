# Access Control Matrix — ROSMAR CRM (P5 Security Audit)

Generated: 2026-03-10

---

## On-Chain: Move Packages

### Package: `crm_core`

#### Module: `capabilities`

| Function | Visibility | Caller Constraint | Cap/Object Required | State Required | Emits Event | Aborts |
|---|---|---|---|---|---|---|
| `assert_not_paused` | public | Any | `&GlobalConfig` | config.paused == false | — | EPaused (0) |
| `pause` | public | EmergencyPauseCap holder | `&mut GlobalConfig`, `&EmergencyPauseCap` | — | — | — |
| `unpause` | public | EmergencyPauseCap holder | `&mut GlobalConfig`, `&EmergencyPauseCap` | — | — | — |
| `is_paused` | public | Any (read-only) | `&GlobalConfig` | — | — | — |
| `create_admin_cap` | public | Any (typically called internally) | — | — | — | — |
| `assert_cap_matches` | public | Any | `&WorkspaceAdminCap` | cap.workspace_id == workspace_id | — | ECapMismatch (2) |
| `cap_workspace_id` | public | Any (read-only) | `&WorkspaceAdminCap` | — | — | — |
| `set_paused` | public(package) | Same package only (multi_sig_pause) | `&mut GlobalConfig` | — | — | — |
| `create_rate_limit` | public | Any | — | — | — | — |
| `check_rate_limit` | public | Any | `&mut RateLimitConfig` | count < max | — | 100 |
| `create_per_user_rate_limit` | public | Any | — | — | — | — |
| `check_user_rate_limit` | public | Any | `&mut PerUserRateLimit` | user count < max_per_epoch | — | EUserRateLimitExceeded (101) |

#### Module: `workspace`

| Function | Visibility | Caller Constraint | Cap/Object Required | State Required | Emits Event | Aborts |
|---|---|---|---|---|---|---|
| `create` | public | Any (becomes owner) | `&GlobalConfig` | not paused | WorkspaceCreated | EPaused |
| `add_member` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&mut Workspace`, `&WorkspaceAdminCap` | not paused, cap matches, member not exists | MemberAdded | EPaused, ECapMismatch, EMemberExists (301) |
| `remove_member` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&mut Workspace`, `&WorkspaceAdminCap` | not paused, cap matches, not owner | MemberRemoved | EPaused, ECapMismatch, ENotOwner (300) |
| `get_member_role` | public | Any (read-only) | `&Workspace` | member exists (DOF) | — | DOF abort if missing |
| `is_member` | public | Any (read-only) | `&Workspace` | — | — | — |
| `id` | public | Any (read-only) | `&Workspace` | — | — | — |
| `owner` | public | Any (read-only) | `&Workspace` | — | — | — |
| `name` | public | Any (read-only) | `&Workspace` | — | — | — |
| `member_count` | public | Any (read-only) | `&Workspace` | — | — | — |

#### Module: `profile`

| Function | Visibility | Caller Constraint | Cap/Object Required | State Required | Emits Event | Aborts |
|---|---|---|---|---|---|---|
| `create` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap` | not paused, cap matches | AuditEventV1 | EPaused, ECapMismatch |
| `update_tier_and_score` | public | Any (whoever has `&mut Profile`) | `&mut Profile` | — | — | — |
| `archive` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut Profile` | not paused, cap matches, ws matches, version matches, not archived | AuditEventV1 | EPaused, ECapMismatch, EWorkspaceMismatch (401), EVersionConflict (400), EAlreadyArchived (402) |
| `add_wallet` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut Profile` | not paused, cap matches, ws matches | — | EPaused, ECapMismatch, EWorkspaceMismatch |
| `set_metadata<V>` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut Profile` | not paused, cap matches, ws matches, version matches | AuditEventV1 | EPaused, ECapMismatch, EWorkspaceMismatch, EVersionConflict |
| `workspace_id`, `primary_address`, `tier`, `engagement_score`, `version`, `is_archived` | public | Any (read-only) | `&Profile` | — | — | — |

#### Module: `deal` (crm_core)

| Function | Visibility | Caller Constraint | Cap/Object Required | State Required | Emits Event | Aborts |
|---|---|---|---|---|---|---|
| `create_deal` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap` | not paused, cap matches, stage <= STAGE_LOST | AuditEventV1 | EPaused, ECapMismatch, EInvalidStage (703) |
| `update_deal` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut Deal` | not paused, cap matches, ws matches, version matches, not archived, valid stage, valid transition | AuditEventV1 | EPaused, ECapMismatch, EWorkspaceMismatch (701), EVersionConflict (700), EAlreadyArchived (702), EInvalidStage (703), EInvalidStageTransition (704) |
| `archive_deal` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut Deal` | not paused, cap matches, ws matches, version matches, not archived | AuditEventV1 | EPaused, ECapMismatch, EWorkspaceMismatch, EVersionConflict, EAlreadyArchived |
| Accessors (`deal_workspace_id`, `deal_stage`, etc.) | public | Any (read-only) | `&Deal` | — | — | — |
| Stage constants (`stage_lead`, `stage_won`, etc.) | public | Any | — | — | — | — |

#### Module: `relation`

| Function | Visibility | Caller Constraint | Cap/Object Required | State Required | Emits Event | Aborts |
|---|---|---|---|---|---|---|
| `create` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap` | not paused, cap matches | AuditEventV1 | EPaused, ECapMismatch |
| `update_type` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut Relation` | not paused, cap matches, ws matches, version matches | AuditEventV1 | EPaused, ECapMismatch, EWorkspaceMismatch (601), EVersionConflict (600) |
| `archive` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut Relation` | not paused, cap matches, ws matches, version matches, not archived | AuditEventV1 | EPaused, ECapMismatch, EWorkspaceMismatch, EVersionConflict, EAlreadyArchived (602) |
| Accessors + type constants | public | Any (read-only) | `&Relation` | — | — | — |

#### Module: `organization`

| Function | Visibility | Caller Constraint | Cap/Object Required | State Required | Emits Event | Aborts |
|---|---|---|---|---|---|---|
| `create` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap` | not paused, cap matches | AuditEventV1 | EPaused, ECapMismatch |
| `update_name` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut Organization` | not paused, cap matches, ws matches, version matches | AuditEventV1 | EPaused, ECapMismatch, EWorkspaceMismatch (501), EVersionConflict (500) |
| `archive` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut Organization` | not paused, cap matches, ws matches, version matches, not archived | AuditEventV1 | EPaused, ECapMismatch, EWorkspaceMismatch, EVersionConflict, EAlreadyArchived (502) |
| `set_metadata<V>` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut Organization` | not paused, cap matches, ws matches, version matches | AuditEventV1 | EPaused, ECapMismatch, EWorkspaceMismatch, EVersionConflict |
| Accessors | public | Any (read-only) | `&Organization` | — | — | — |

#### Module: `acl`

| Function | Visibility | Caller Constraint | Cap/Object Required | State Required | Emits Event | Aborts |
|---|---|---|---|---|---|---|
| `viewer`, `member`, `admin`, `owner` | public | Any | — | — | — | — |
| `has_permission` | public | Any | `&Role` | — | — | — |
| `assert_permission` | public | Any | `&Role` | permission bits set | — | EInsufficientPermission (200) |
| `level`, `permissions` | public | Any (read-only) | `&Role` | — | — | — |
| `custom_role` | public | Any | — | — | — | — |
| Permission constants (`perm_read`, etc.) | public | Any | — | — | — | — |

#### Module: `admin_recovery`

| Function | Visibility | Caller Constraint | Cap/Object Required | State Required | Emits Event | Aborts |
|---|---|---|---|---|---|---|
| `recover_admin_cap` | public | Workspace owner (ctx.sender == workspace.owner) | `&GlobalConfig`, `&Workspace` | not paused, caller is owner | — | EPaused, ENotWorkspaceOwner (900) |

#### Module: `multi_sig_pause`

| Function | Visibility | Caller Constraint | Cap/Object Required | State Required | Emits Event | Aborts |
|---|---|---|---|---|---|---|
| `create_proposal` | public | Must be in voters list | — | threshold valid (1..=voter_count), sender in voters | — | EInvalidThreshold (912), ENotAuthorized (910) |
| `vote` | public | Must be in voters list | `&mut PauseProposal`, `&mut GlobalConfig` | not resolved, sender in voters, not already voted | — | EAlreadyResolved (913), ENotAuthorized (910), EAlreadyVoted (911) |
| Accessors (`is_resolved`, `signer_count`, action constants) | public | Any (read-only) | `&PauseProposal` | — | — | — |

---

### Package: `crm_data`

#### Module: `campaign`

| Function | Visibility | Caller Constraint | Cap/Object Required | State Required | Emits Event | Aborts |
|---|---|---|---|---|---|---|
| `create` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap` | not paused, cap matches | AuditEventV1 | EPaused, ECapMismatch |
| `launch` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut Campaign` | not paused, cap matches, ws matches, status DRAFT or PAUSED | CampaignStatusChanged, AuditEventV1 | EPaused, ECapMismatch, EWorkspaceMismatch (800), EInvalidTransition (801) |
| `pause` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut Campaign` | not paused, cap matches, ws matches, status ACTIVE | CampaignStatusChanged, AuditEventV1 | EPaused, ECapMismatch, EWorkspaceMismatch, EInvalidTransition |
| `complete` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut Campaign` | not paused, cap matches, ws matches, status ACTIVE | CampaignStatusChanged, AuditEventV1 | EPaused, ECapMismatch, EWorkspaceMismatch, EInvalidTransition |
| Accessors + status constants | public | Any (read-only) | `&Campaign` | — | — | — |

#### Module: `deal` (crm_data)

| Function | Visibility | Caller Constraint | Cap/Object Required | State Required | Emits Event | Aborts |
|---|---|---|---|---|---|---|
| `create` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap` | not paused, cap matches | AuditEventV1 | EPaused, ECapMismatch |
| `advance_stage` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut Deal` | not paused, cap matches, ws matches, version matches, not archived, valid transition | DealStageChanged, AuditEventV1 | EPaused, ECapMismatch, EWorkspaceMismatch (901), EVersionConflict (900), EAlreadyArchived (903), EInvalidTransition (902) |
| `archive` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut Deal` | not paused, cap matches, ws matches, version matches, not archived | AuditEventV1 | EPaused, ECapMismatch, EWorkspaceMismatch, EVersionConflict, EAlreadyArchived |
| Accessors + stage constants | public | Any (read-only) | `&Deal` | — | — | — |

#### Module: `segment`

| Function | Visibility | Caller Constraint | Cap/Object Required | State Required | Emits Event | Aborts |
|---|---|---|---|---|---|---|
| `create` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap` | not paused, cap matches | AuditEventV1 | EPaused, ECapMismatch |
| `update_rule_hash` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut Segment` | not paused, cap matches, ws matches, version matches | AuditEventV1 | EPaused, ECapMismatch, EWorkspaceMismatch (701), EVersionConflict (700) |
| `update_member_count` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut Segment` | not paused, cap matches, ws matches | — | EPaused, ECapMismatch, EWorkspaceMismatch |
| Accessors | public | Any (read-only) | `&Segment` | — | — | — |

#### Module: `ticket`

| Function | Visibility | Caller Constraint | Cap/Object Required | State Required | Emits Event | Aborts |
|---|---|---|---|---|---|---|
| `create` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap` | not paused, cap matches | AuditEventV1 | EPaused, ECapMismatch |
| `transition_status` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut Ticket` | not paused, cap matches, ws matches, version matches, valid FSM transition | TicketStatusChanged, AuditEventV1 | EPaused, ECapMismatch, EWorkspaceMismatch (1001), EVersionConflict (1000), EInvalidTransition (1002) |
| `assign` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut Ticket` | not paused, cap matches, ws matches | — | EPaused, ECapMismatch, EWorkspaceMismatch |
| Accessors + status/priority constants | public | Any (read-only) | `&Ticket` | — | — | — |

---

### Package: `crm_escrow`

#### Module: `escrow`

| Function | Visibility | Caller Constraint | Cap/Object Required | State Required | Emits Event | Aborts |
|---|---|---|---|---|---|---|
| `create_escrow` | public | WorkspaceAdminCap holder (payer = sender) | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&Clock` | not paused, cap matches, threshold valid, arbitrators != payer/payee, expiry >= now + 1h | EscrowCreated, AuditEventV1 | EPaused, ECapMismatch, EInvalidThreshold (1507), EArbitratorIsPayer (1511), EArbitratorIsPayee (1512), EMinLockDuration (1513) |
| `fund_escrow` | public | Payer only | `&mut Escrow`, `Coin<SUI>`, `&Clock` | state == CREATED, coin > 0 | EscrowFunded | EInvalidStateTransition (1503), ENotPayer (1500), EOverRelease (1504) |
| `release` | public | Payer only | `&mut Escrow`, `&Clock` | state FUNDED/PARTIALLY_RELEASED, time >= funded_at + 1h, amount <= balance | EscrowReleased | EInvalidStateTransition, ENotPayer, EMinLockDuration, EOverRelease |
| `claim_before_expiry` | public | Payee only | `&mut Escrow`, `&Clock` | state FUNDED/PARTIALLY_RELEASED, expiry set, within [expiry-24h, expiry), balance > 0 | EscrowReleased | EInvalidStateTransition, ENotPayee (1501), ENotExpired (1509), ENotInClaimWindow (1515), EOverRelease |
| `refund` | public | Payer only | `&mut Escrow`, `&Clock` | CREATED, or expired, or (FUNDED/PR + no expiry) | EscrowRefunded | ENotPayer, EInvalidStateTransition |
| `add_vesting` | public | Payer only | `&mut Escrow`, `&Clock` | state FUNDED, no vesting yet, milestones sum 10000bp if milestone type | — | EInvalidStateTransition, ENotPayer, EVestingAlreadySet (1505), EMilestonePercentageMismatch (1506) |
| `release_vested` | public | Payer only | `&mut Escrow`, `&Clock` | state FUNDED/PR, has vesting, releasable > released, to_release > 0 | EscrowReleased | EInvalidStateTransition, ENotPayer, EOverRelease |
| `complete_milestone` | public | Payer only | `&mut Escrow`, `&Clock` | state FUNDED/PR, has vesting | MilestoneCompleted | EInvalidStateTransition, ENotPayer |
| `raise_dispute` | public | Payer or Payee | `&mut Escrow`, `&Clock` | state FUNDED/PR | DisputeRaised | EInvalidStateTransition, ENotPayer (reused for payer-or-payee check) |
| `vote_on_dispute` | public | Registered arbitrator | `&mut Escrow`, `&Clock` | state DISPUTED, not already voted | DisputeVoteCast, DisputeResolved (if threshold) | EInvalidStateTransition, ENotArbitrator (1502), EAlreadyVoted (1508) |
| `commit_vote` | public | Registered arbitrator | `&mut Escrow`, `&Clock` | state DISPUTED, not voted, not committed | — | EInvalidStateTransition, ENotArbitrator, EAlreadyVoted, ECommitmentExists (1520) |
| `reveal_vote` | public | Registered arbitrator (committed) | `&mut Escrow`, `&Clock` | state DISPUTED, has commitment, before deadline, hash matches | DisputeVoteCast, DisputeResolved (if threshold) | EInvalidStateTransition, ENoCommitment (1521), ERevealDeadlinePassed (1523), ERevealMismatch (1522) |
| `new_milestone` | public | Any (constructor) | — | — | — | — |
| Accessors + state constants | public | Any (read-only) | `&Escrow` | — | — | — |

#### Module: `arbitration`

| Function | Visibility | Caller Constraint | Cap/Object Required | State Required | Emits Event | Aborts |
|---|---|---|---|---|---|---|
| `decision_release` | public | Any (constant) | — | — | — | — |
| `decision_refund` | public | Any (constant) | — | — | — | — |

#### Module: `vesting`

| Function | Visibility | Caller Constraint | Cap/Object Required | State Required | Emits Event | Aborts |
|---|---|---|---|---|---|---|
| `linear_type`, `milestone_type`, `basis_points_total` | public | Any (constants) | — | — | — | — |
| `calc_linear_vested` | public | Any (pure math) | — | — | — | — |
| `calc_milestone_vested_from_bp` | public | Any (pure math) | — | — | — | — |

---

### Package: `crm_vault`

#### Module: `vault`

| Function | Visibility | Caller Constraint | Cap/Object Required | State Required | Emits Event | Aborts |
|---|---|---|---|---|---|---|
| `create` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap` | not paused, cap matches | AuditEventV1 | EPaused, ECapMismatch |
| `set_blob` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut Vault` | not paused, cap matches, ws matches, version matches, not archived | AuditEventV1 | EPaused, ECapMismatch, EWorkspaceMismatch (1101), EVersionConflict (1100), EAlreadyArchived (1102) |
| `archive` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut Vault` | not paused, cap matches, ws matches, version matches, not archived | AuditEventV1 | EPaused, ECapMismatch, EWorkspaceMismatch, EVersionConflict, EAlreadyArchived |
| Accessors + type constants | public | Any (read-only) | `&Vault` | — | — | — |

#### Module: `policy`

| Function | Visibility | Caller Constraint | Cap/Object Required | State Required | Emits Event | Aborts |
|---|---|---|---|---|---|---|
| `create_workspace_policy` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap` | not paused, cap matches | AuditEventV1 | EPaused, ECapMismatch |
| `create_address_policy` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap` | not paused, cap matches | AuditEventV1 | EPaused, ECapMismatch |
| `create_role_policy` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap` | not paused, cap matches | AuditEventV1 | EPaused, ECapMismatch |
| `add_address` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut AccessPolicy` | not paused, cap matches, ws matches, version matches | AuditEventV1 | EPaused, ECapMismatch, EWorkspaceMismatch (1201), EVersionConflict (1200) |
| `seal_approve` | entry | Depends on rule_type: WORKSPACE_MEMBER=any, SPECIFIC_ADDRESS=listed, ROLE_BASED=any (BFF enforces) | `&AccessPolicy` | id bytes == policy object address | — | ESealNoAccess (1202), ESealInvalidIdentity (1203) |
| Accessors + rule constants | public | Any (read-only) | `&AccessPolicy` | — | — | — |

---

### Package: `crm_action`

#### Module: `airdrop`

| Function | Visibility | Caller Constraint | Cap/Object Required | State Required | Emits Event | Aborts |
|---|---|---|---|---|---|---|
| `batch_airdrop` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `Coin<SUI>` | not paused, cap matches, recipients > 0, fund >= total | AirdropExecuted, AuditEventV1 | EPaused, ECapMismatch, EEmptyRecipients (1300), EInsufficientFunds (1301) |
| `batch_airdrop_variable` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `Coin<SUI>` | not paused, cap matches, recipients > 0, recipients.len == amounts.len | AirdropExecuted | EPaused, ECapMismatch, EEmptyRecipients |

#### Module: `reward`

| Function | Visibility | Caller Constraint | Cap/Object Required | State Required | Emits Event | Aborts |
|---|---|---|---|---|---|---|
| `distribute` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&Campaign`, `Coin<SUI>` | not paused, cap matches, campaign ws matches, campaign ACTIVE, fund >= amount | RewardDistributed, AuditEventV1 | EPaused, ECapMismatch, EWorkspaceMismatch (1400), ECampaignNotActive (1401), EInsufficientFunds (1402) |
| `batch_distribute` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&Campaign`, `Coin<SUI>` | not paused, cap matches, campaign ws matches, campaign ACTIVE, fund >= total | RewardDistributed | EPaused, ECapMismatch, EWorkspaceMismatch, ECampaignNotActive, EInsufficientFunds |
| Accessors | public | Any (read-only) | `&RewardRecord` | — | — | — |

#### Module: `quest_badge`

| Function | Visibility | Caller Constraint | Cap/Object Required | State Required | Emits Event | Aborts |
|---|---|---|---|---|---|---|
| `mint_badge` | public | WorkspaceAdminCap holder | `&GlobalConfig`, `&Workspace`, `&WorkspaceAdminCap`, `&mut QuestRegistry` | not paused, cap matches, dedup key not in registry | QuestBadgeMinted, AuditEventV1 | EPaused, ECapMismatch, EDuplicateBadge (1600) |
| `make_dedup_key` | public | Any (pure helper) | — | — | — | — |
| Accessors | public | Any (read-only) | `&QuestBadge` | — | — | — |

---

## Off-Chain: BFF (NestJS) Endpoints

All endpoints use cookie-based session auth (`SessionGuard`) unless noted. Most domain controllers additionally use `RbacGuard` for workspace-scoped role checks.

| Controller | Route Prefix | Guard(s) | Endpoints |
|---|---|---|---|
| `AppController` | `/` | None (public) | `GET /`, `GET /health` |
| `HealthController` | `/health` | None (public) | `GET /`, `GET /detailed` |
| `AuthController` | `/auth` | Mixed | `GET /challenge` (public), `POST /login` (public), `POST /zklogin` (public), `POST /passkey/register/*` (SessionGuard), `POST /passkey/login/*` (public), `POST /refresh` (public), `POST /switch-workspace` (SessionGuard), `POST /logout` (public) |
| `TestAuthController` | `/auth` | None (public, dev only) | `POST /test-login` |
| `WorkspaceController` | `/workspaces` | SessionGuard + RbacGuard | `POST /`, `GET /`, `GET /:id`, `PATCH /:id`, `GET /:id/members`, `POST /:id/members`, `DELETE /:id/members/:address` |
| `ProfileController` | `/profiles` | SessionGuard + RbacGuard | `POST /`, `GET /:id`, `GET /:id/assets`, `GET /:id/timeline`, `GET /`, `GET /:id/organizations`, `PUT /:id/tags`, `DELETE /:id`, `POST /:id/wallets`, `GET /:id/wallets`, `DELETE /:id/wallets/:walletId`, `GET /:id/net-worth` |
| `OrganizationController` | `/organizations` | SessionGuard + RbacGuard | `POST /`, `GET /:id`, `GET /`, `PUT /:id`, `POST /:orgId/profiles/:profileId`, `GET /:id/profiles`, `DELETE /:orgId/profiles/:profileId` |
| `DealController` | `/deals` | SessionGuard + RbacGuard | `POST /`, `GET /:id`, `GET /`, `PUT /:id`, `PUT /:id/stage`, `PUT /:id/archive`, `GET /:id/audit`, `POST /:id/documents`, `GET /:id/documents`, `DELETE /documents/:docId` |
| `EscrowController` | `/deals/:dealId/escrow` | SessionGuard + RbacGuard | `POST /`, `POST /fund`, `POST /release`, `POST /refund`, `POST /dispute`, `POST /dispute/vote`, `GET /`, `POST /vesting`, `POST /milestone/:idx/complete` |
| `SaftTemplateController` | `/saft-templates` | SessionGuard + RbacGuard | `POST /`, `GET /`, `PUT /:id/attach`, `PUT /:id/upload` |
| `CampaignController` | `/campaigns` | SessionGuard + RbacGuard | `GET /templates/playbooks`, `POST /`, `GET /:id`, `GET /`, `PUT /:id`, `POST /:id/start`, `POST /:id/pause`, `GET /:id/stats`, `POST /:id/triggers`, `GET /:id/triggers`, `PATCH /:id/triggers/:triggerId`, `DELETE /:id/triggers/:triggerId` |
| `SegmentController` | `/segments` | SessionGuard + RbacGuard | `POST /`, `GET /:id`, `GET /:id/profiles`, `GET /`, `PUT /:id`, `DELETE /:id`, `POST /:id/refresh` |
| `LookalikeController` | `/segments` | SessionGuard + RbacGuard | `POST /:id/lookalike`, `POST /:id/lookalike/create-segment` |
| `TicketController` | `/tickets` | SessionGuard + RbacGuard | `POST /`, `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| `VaultController` | `/vault` | SessionGuard + RbacGuard | `POST /secrets`, `GET /secrets/:profileId/:key`, `GET /secrets/:profileId`, `PUT /secrets/:profileId/:key`, `DELETE /secrets/:profileId/:key`, `GET /secrets/:profileId/:key/audit` |
| `QuestController` | `/quests` | SessionGuard | `POST /`, `GET /`, `GET /:id`, `PUT /:id`, `POST /:id/steps/:stepId/claim`, `GET /:id/progress/:profileId` |
| `AnalyticsController` | `/analytics` | SessionGuard + RbacGuard | `GET /score-distribution`, `GET /profiles/:id/score`, `GET /activity-heatmap`, `GET /pipeline-summary` |
| `BroadcastController` | `/broadcasts` | SessionGuard + RbacGuard | `POST /`, `PATCH /:id`, `POST /:id/send`, `POST /:id/schedule`, `GET /`, `GET /:id/analytics` |
| `MessagingController` | `/messaging` | SessionGuard + RbacGuard | `POST /send`, `GET /history/:profileId` |
| `NotificationController` | `/notifications` | SessionGuard | `GET /`, `GET /unread-count`, `PATCH /:id/read`, `POST /mark-all-read` |
| `SocialLinkController` | `/social` | None / mixed (OAuth callbacks) | `GET /discord/auth-url`, `GET /discord/callback`, `GET /x/auth-url`, `GET /x/callback`, `POST /telegram/verify`, `POST /:profileId/apple`, `GET /:profileId/links`, `DELETE /:profileId/:platform` |
| `SponsorController` | `/sponsor` | SessionGuard (per-method) | `POST /create`, `POST /execute` |
| `AgentController` | `/agent` | SessionGuard + RbacGuard | `GET /config`, `PUT /config`, `GET /usage` |
| `ActionController` | `/agents/action` | SessionGuard + RbacGuard | `POST /plan`, `POST /execute` |
| `AnalystController` | `/agents/analyst` | SessionGuard + RbacGuard | `POST /query` |
| `ContentController` | `/agents/content` | SessionGuard + RbacGuard | `POST /generate` |
| `GdprController` | `/profiles` | SessionGuard | `DELETE /:id/gdpr`, `GET /:id/gdpr/status`, `POST /:id/gdpr/cancel`, `GET /:id/export` |
| `WebhookController` | `/webhooks` | WebhookSignatureGuard | `POST /indexer-event` |

### Auth / Guard Summary

- **SessionGuard**: Validates JWT from httpOnly cookie. Extracts `userId`, `walletAddress`, `workspaceId` into request context. All non-public endpoints require this.
- **RbacGuard**: Checks workspace membership and role-level permissions. Applied to domain controllers (profiles, deals, orgs, etc.) to enforce workspace isolation.
- **WebhookSignatureGuard**: HMAC signature verification for indexer webhook callbacks.
- **Global ThrottlerGuard**: Rate limiting via `@nestjs/throttler` (configured in AppModule). Applies to all endpoints.
- **Workspace Isolation**: Every data query is scoped by `workspaceId` from session. No endpoint allows cross-workspace reads without workspace switching (`POST /auth/switch-workspace`).
