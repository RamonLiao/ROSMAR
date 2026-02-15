# BFF Prisma DB Wiring Design

## Goal
Replace raw `pg` Pool + mock data in BFF services with Prisma ORM for the core 4 entities (Profile, Organization, Deal, Segment) plus Workspace.

## Decisions
- **ORM**: Prisma (type-safe, auto-generated client, migrations)
- **Read path**: Keep gRPC stubs unchanged (reads still go through Rust indexer when ready)
- **Write path**: Sui TX → Prisma optimistic write
- **Dry-run**: `SUI_DRY_RUN=true` env var skips Sui TX, generates UUID IDs, lets DB layer work independently

## Schema (8 tables)

```
workspaces            — id, sui_object_id, name, owner_address, created_at
workspace_members     — workspace_id + address (composite PK), role_level, permissions, joined_at
profiles              — id, workspace_id, primary_address, suins_name, tags[], tier, engagement_score, version, is_archived
organizations         — id, workspace_id, name, domain, tags[], version
deals                 — id, workspace_id, profile_id, title, amount_usd, stage, version
segments              — id, workspace_id, name, description, rules (Json), version, last_refreshed_at
profile_organizations — profile_id + organization_id (junction)
segment_memberships   — segment_id + profile_id (junction)
```

## Files

| Action | File |
|--------|------|
| New | `packages/bff/prisma/schema.prisma` |
| New | `packages/bff/src/prisma/prisma.module.ts` + `prisma.service.ts` |
| Modify | `packages/bff/src/app.module.ts` — wire all domain modules |
| Modify | `packages/bff/src/blockchain/sui.client.ts` — add dry-run flag |
| Modify | profile, org, deal, segment services — replace pg.Pool with PrismaService |
| Modify | workspace.service.ts — replace mock with Prisma |
| Modify | `packages/bff/package.json` — add prisma, @prisma/client |
| New | `packages/bff/.env.example` |

## Out of scope
- Campaign, Vault, Messaging, Jobs services (future session)
- gRPC client wiring (keep stubs)
- Auth service changes
