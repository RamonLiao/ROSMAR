# Platform Billing & Walrus Publisher Management

Status: Future scope (not part of current CRM)
Created: 2026-03-06

## Context

ROSMAR CRM's Vault feature stores encrypted notes/files via Walrus (decentralized storage).
Currently the BFF server uploads to Walrus on behalf of users — users don't interact with
Walrus directly and don't pay storage fees.

On testnet, Mysten's public publisher is free. On mainnet, the platform needs to run its own
Walrus publisher node funded with WAL tokens. This cost is absorbed as operational expense.

## When This Becomes Relevant

Before mainnet commercial launch, the following systems need to be built.

## Scope — Platform Admin / Billing Service (independent app)

### 1. Walrus Publisher Infrastructure (DevOps)

- Self-hosted Walrus publisher node
- WAL token treasury management (staking, top-up alerts)
- Publisher health monitoring & failover
- Env config: `WALRUS_PUBLISHER_URL` already parameterized in BFF

### 2. Storage Quota Management (Backend)

- Per-workspace storage quota (e.g., Free: 100MB, Pro: 5GB, Enterprise: unlimited)
- Usage tracking: accumulate `fileSize` from VaultSecret records per workspace
- Quota enforcement: BFF checks remaining quota before `uploadBlob()`
- Admin dashboard: view/adjust quotas per workspace

### 3. Subscription & Billing (Business Logic)

- Subscription tiers with storage limits
- Payment integration (Stripe / crypto payments)
- Upgrade/downgrade flows
- Invoice generation & history
- Grace period on quota exceeded (warn, then block new uploads)

### 4. User-Facing Settings (CRM Integration)

- Settings page: "Storage" section showing used / remaining space
- Usage breakdown by vault type (notes vs files)
- Subscription tier display + upgrade CTA
- Billing history / invoice download

### 5. Usage Analytics (Platform Admin)

- Aggregate storage usage across all workspaces
- WAL token burn rate vs revenue
- Growth projections for infrastructure planning

## Architecture Decision

```
CRM (Vault)  ──POST /vault/secrets──>  BFF  ──uploadBlob──>  Walrus Publisher
                                        |
                                        v
                                  Billing Service (future)
                                    - quota check
                                    - usage metering
                                    - subscription state
```

The CRM is a **consumer** of the billing service. The billing service is an independent
application that:
- Exposes internal APIs for quota checks (`GET /billing/quota/:workspaceId`)
- BFF calls quota check before uploading to Walrus
- Manages subscription lifecycle independently
- Can serve multiple products beyond CRM

## Integration Points with Current CRM

When billing service is ready, CRM changes needed:

1. **BFF `vault.service.ts`**: Add quota check before `walrusClient.uploadBlob()`
2. **Frontend settings page**: Add storage usage section (new API endpoint)
3. **VaultItemForm**: Show remaining quota, disable upload when exceeded

These are minimal, additive changes — current Vault architecture doesn't need restructuring.

## Non-Goals for Current CRM

- User-facing WAL token management
- Direct-to-Walrus upload from browser
- Per-upload billing (microtransactions)
- Multi-region publisher failover (single node is sufficient initially)
