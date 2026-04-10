# 20 — Engagement Score Weights

> Prerequisite: Login complete (01). Workspace created (02). At least 1 profile with on-chain activity for score verification.

## 20.1 Engagement Weights Settings

### Steps

- [ ] **20.1.1** Navigate to **Settings** (`/settings/workspace`)
  - Verify: Engagement Weights card visible

- [ ] **20.1.2** Verify 5 sliders:
  - Hold Time (range 0–100, step 5)
  - TX Count (range 0–100, step 5)
  - TX Value (range 0–100, step 5)
  - Vote Count (range 0–100, step 5)
  - NFT Count (range 0–100, step 5)
  - Verify: Each slider shows current value (displayed as 0–100, stored as 0.00–1.00)
  - Verify: Total value shown at bottom

---

## 20.2 Adjust Weights

### Steps

- [ ] **20.2.1** Move **TX Value** slider to 80
  - Verify: Slider updates in real time
  - Verify: Total recalculates

- [ ] **20.2.2** Move **NFT Count** slider to 60
  - Verify: Both changes reflected

- [ ] **20.2.3** Save
  - Verify: Weights persisted to workspace config
  - Verify: Success feedback

- [ ] **20.2.4** Refresh page
  - Verify: Saved values persist (TX Value = 80, NFT Count = 60)

---

## 20.3 Reset Defaults

### Steps

- [ ] **20.3.1** Click **"Reset Defaults"**
  - Verify: All sliders return to original default values
  - Verify: Total recalculates

- [ ] **20.3.2** Save after reset
  - Verify: Defaults persisted

---

## 20.4 Score Impact Verification

### Steps

- [ ] **20.4.1** Set extreme weights (e.g. TX Value = 100, all others = 0), save
  - Check a profile's engagement score:
  ```
  curl http://localhost:3001/api/profiles/{id} \
    -H "Cookie: access_token=..."
  ```
  - Verify: Score reflects the weight bias (profiles with high TX value score higher)
  - Note: Score recalculation may be async (BullMQ job)

- [ ] **20.4.2** Reset to defaults after testing
