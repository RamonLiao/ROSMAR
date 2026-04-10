# 17 — Gas Station (Sponsored Transactions)

> Prerequisite: Login complete (01). Workspace created (02).

## 17.1 Gas Config Settings

### Steps

- [ ] **17.1.1** Navigate to **Settings** (`/settings/workspace`)
  - Verify: Gas Station settings section visible

- [ ] **17.1.2** Verify default config:
  - Enabled toggle: **off**
  - Threshold: 0.1 SUI (displayed in SUI, stored as MIST internally)
  - Daily Limit: 5

- [ ] **17.1.3** Toggle **Enabled** on
  - Set Threshold: `0.5` SUI
  - Set Daily Limit: `10`
  - Save
  - Verify: `PUT /workspaces/:id/gas-config` called with `{ enabled: true, thresholdMist: 500000000, dailyLimit: 10 }`
  - Verify: Success feedback

- [ ] **17.1.4** Refresh page
  - Verify: Settings persist (Enabled on, Threshold 0.5, Daily Limit 10)

- [ ] **17.1.5** Toggle **Enabled** off, save
  - Verify: Gas sponsorship disabled

---

## 17.2 Sponsored Transaction Flow (API)

> Requires gas station enabled and `SUI_DRY_RUN=false` for real on-chain test.

### Steps

- [ ] **17.2.1** Create a sponsored TX:
  ```
  curl -X POST http://localhost:3001/api/sponsor/create \
    -H "Cookie: access_token=..." \
    -H "Content-Type: application/json" \
    -d '{"txKindBytes": "<base64-encoded-tx-kind>"}'
  ```
  - Verify: Returns sponsored transaction data (digest, bytes to sign)

- [ ] **17.2.2** Execute the sponsored TX:
  ```
  curl -X POST http://localhost:3001/api/sponsor/execute \
    -H "Cookie: access_token=..." \
    -H "Content-Type: application/json" \
    -d '{"digest": "<digest-from-step-1>", "signature": "<user-signature>"}'
  ```
  - Verify: Returns execution result with tx digest

### Failure Cases

- [ ] **17.2.3** Call `/sponsor/create` with gas station **disabled**
  - Verify: Appropriate error response (not 500)

- [ ] **17.2.4** Exceed daily limit (create > dailyLimit transactions in one day)
  - Verify: Rate limit error returned
