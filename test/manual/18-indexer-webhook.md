# 18 — Indexer, Webhook & Auto-Tag

> Prerequisite: Rust indexer binary built (`cargo build` in `packages/indexer`). BFF running. TimescaleDB + Redis running.

## 18.1 Indexer Startup

### Steps

- [ ] **18.1.1** Start the Rust indexer:
  ```bash
  cd packages/indexer && cargo run
  ```
  - Verify: Logs show successful connection to checkpoint source
  - Verify: Logs show "Starting worker..." or similar initialization message
  - Verify: No panic or crash on startup

- [ ] **18.1.2** Verify checkpoint consumption:
  - Verify: Logs show checkpoint numbers being processed
  - Verify: `wallet_events` table in DB receiving new rows:
  ```sql
  SELECT COUNT(*) FROM wallet_events WHERE created_at > NOW() - INTERVAL '5 minutes';
  ```

---

## 18.2 Webhook Delivery (Indexer → BFF)

### Steps

- [ ] **18.2.1** With indexer running, check BFF logs for incoming webhook events:
  - Verify: Logs show webhook received (e.g. `POST /api/webhook/events`)

- [ ] **18.2.2** Verify HMAC signature validation:
  ```bash
  # Send a test webhook with WRONG signature
  curl -X POST http://localhost:3001/api/webhook/events \
    -H "Content-Type: application/json" \
    -H "x-webhook-signature: invalid-sig" \
    -d '{"events": []}'
  ```
  - Verify: Rejected with 401/403 (HMAC mismatch)

- [ ] **18.2.3** Verify Redis idempotency:
  - Send the same event payload twice (with valid HMAC)
  - Verify: Second delivery is deduplicated (not processed again)
  - Check BFF logs for "duplicate event" or idempotency skip message

---

## 18.3 Event Fan-Out (EventEmitter2)

### Steps

- [ ] **18.3.1** After indexer delivers events:
  - Verify: `wallet_events` rows have `profile_id` and `workspace_id` populated (enrichment worked)

- [ ] **18.3.2** Check that downstream listeners fire:
  - Whale alert listener: large transactions trigger notifications (if above threshold from test 16)
  - Auto-tag listener: profile tags updated based on event types

---

## 18.4 Auto-Tag Verification

> Auto-tag is event-driven (no API endpoint). Tags are applied automatically when indexer events match rule conditions.

### Steps

- [ ] **18.4.1** Check a profile that has on-chain activity:
  ```
  curl http://localhost:3001/api/profiles/{id} \
    -H "Cookie: access_token=..."
  ```
  - Verify: `tags` array may include `auto:` prefixed tags

- [ ] **18.4.2** Expected auto-tags based on activity:

  | Tag | Trigger |
  |-----|---------|
  | `auto:NFT_Collector` | >= 5 MintNFT/TransferObject events (all time) |
  | `auto:DeFi_Power_User` | >= 10 Swap/AddLiquidity/Stake events (last 30d) |
  | `auto:DAO_Voter` | >= 3 Vote/Delegate events (last 90d) |
  | `auto:Whale` | Swap/AddLiquidity sum >= $100k (last 30d) |
  | `auto:Diamond_Hands` | >= 1 Stake event (all time) |

- [ ] **18.4.3** Verify manual tags are NOT overwritten:
  - Add a manual tag to a profile (e.g. `vip`)
  - Wait for next auto-tag evaluation
  - Verify: `vip` tag still present alongside any `auto:` tags

---

## 18.5 Indexer Resilience

### Steps

- [ ] **18.5.1** Stop the indexer, wait 30 seconds, restart
  - Verify: Resumes from last processed checkpoint (no data gap)
  - Verify: No duplicate events in `wallet_events`

- [ ] **18.5.2** Stop BFF while indexer is running
  - Verify: Indexer logs webhook delivery failures (but does not crash)
  - Restart BFF
  - Verify: Webhook delivery resumes
