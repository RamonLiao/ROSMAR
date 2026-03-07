# Governance Event Specification

**Date**: 2026-03-07
**Status**: Draft
**Related**: P2-1 Rust Indexer

---

## Overview

Generic governance event schema for the ROSMAR CRM indexer. Designed to be extensible for future CRM-specific governance features.

## Event Schema

### DB Table: `wallet_events`

Governance events are stored in the shared `wallet_events` hypertable with `event_type` prefix `governance_*`.

| Field | Type | Description |
|-------|------|-------------|
| time | TIMESTAMPTZ | Event timestamp |
| address | TEXT | Voter wallet address |
| event_type | TEXT | `governance_vote`, `governance_propose`, `governance_execute` |
| contract_address | TEXT | DAO/protocol contract address |
| token | TEXT | Governance token type (if applicable) |
| amount | BIGINT | Vote weight |
| tx_digest | TEXT | Transaction digest |
| raw_data | JSONB | Full event data (see below) |

### raw_data JSONB Structure

```json
{
  "proposal_id": "string",
  "voter": "0x...",
  "vote_type": "for | against | abstain",
  "weight": 1000,
  "protocol": "generic",
  "dao_id": "0x... | null",
  "proposal_title": "string | null",
  "execution_hash": "string | null"
}
```

### Supported Event Types

| event_type | Description |
|------------|-------------|
| `governance_vote` | Cast vote on proposal |
| `governance_propose` | Create new proposal |
| `governance_execute` | Execute passed proposal |

## Event Type Matching

The indexer matches governance events by checking the Sui event type string:

```rust
// Generic patterns (current)
"*::governance::*"
"*::dao::*"
"*::voting::*"
"*::proposal::*"

// Future: CRM-specific (P2-7+)
"{CRM_CORE_PACKAGE_ID}::governance::VoteEvent"
"{CRM_CORE_PACKAGE_ID}::governance::ProposalCreated"
```

## Extension Points

### Adding CRM-Specific Governance

When `crm_core` adds governance modules:

1. Add new event type patterns to `router.rs` matching rules
2. Handler parses CRM-specific fields into `raw_data`
3. `protocol` field set to `"crm_core"` instead of `"generic"`
4. BFF can filter by `protocol` to distinguish CRM vs external governance

### Adding New Protocols

To add a specific protocol (e.g., Kriya DAO):

1. Add event type pattern: `"{KRIYA_PACKAGE_ID}::governance::*"`
2. Optionally add protocol-specific parser in handler
3. Set `protocol` field to `"kriya"`
4. Generic fields (proposal_id, voter, vote_type, weight) remain consistent

## Webhook Payload

```json
{
  "event_id": "uuid",
  "event_type": "governance_vote",
  "profile_id": "uuid | null",
  "address": "0x...",
  "data": {
    "proposal_id": "...",
    "vote_type": "for",
    "weight": 1000,
    "protocol": "generic",
    "dao_id": null
  },
  "tx_digest": "...",
  "timestamp": 1709827200000
}
```
