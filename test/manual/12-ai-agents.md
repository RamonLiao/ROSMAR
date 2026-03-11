# 12 — AI Agents

> Prerequisite: Login complete (01). Profiles (04), deals (03), segments (06) created for meaningful query data.
> Requires: `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` configured in BFF `.env`.

## 12.1 Analyst Agent (Natural Language Query)

**Location:** Analytics page → chat interface

### Steps

- [ ] **12.1.1** Navigate to **Analytics** (`/analytics`)
  - Verify: Analyst chat card visible (600px height, chat interface)
  - Verify: Input bar with placeholder text and Send button

- [ ] **12.1.2** Type: `How many profiles do we have?`
  - Click Send (or press Enter)
  - Verify: User message bubble appears (right-aligned)
  - Verify: Loading indicator while LLM processes
  - Verify: Bot response bubble appears (left-aligned) with summary text
  - Verify: If data returned, `DataTable` shows results (up to 50 rows)

- [ ] **12.1.3** Type: `Show me all deals worth more than $10,000`
  - Verify: Bot returns summary + data table with matching deals
  - Verify: Table columns match deal fields (title, amount, stage, etc.)

- [ ] **12.1.4** Type: `Which profiles are tagged as whale?`
  - Verify: Returns profile list filtered by tag

- [ ] **12.1.5** Test chart suggestion:
  - Type: `Show me deal pipeline distribution by stage`
  - Verify: Response may include `chartConfig` hint (type, xKey, yKey)

### Failure Cases

- [ ] **12.1.6** Type gibberish: `asdfghjkl`
  - Verify: Bot responds gracefully (e.g. "I don't understand" or attempts interpretation)
  - Verify: No crash

- [ ] **12.1.7** If LLM API key not configured:
  - Verify: Error message indicates configuration issue (not unhandled 500)

---

## 12.2 Content Agent (AI-Generated Marketing Copy)

**Location:** Campaign pages → "AI Suggest" popover button

### Steps

- [ ] **12.2.1** Navigate to a campaign detail page (`/campaigns/[id]`)
  - Verify: "AI Suggest" button visible (Sparkles icon)

- [ ] **12.2.2** Click **"AI Suggest"**
  - Verify: Popover opens with form:
    - Target Audience textarea
    - Channel select (Telegram, Discord, Email, X)
    - Tone select (6 options: professional, casual, urgent, friendly, formal, playful)
    - "Generate" button

- [ ] **12.2.3** Fill in:
  - Target Audience: `VIP whale holders who haven't interacted in 30 days`
  - Channel: `Telegram`
  - Tone: `friendly`
  - Click **"Generate"**
  - Verify: Loading state on button
  - Verify: Generated copy appears in popover (or fills into campaign editor)
  - Verify: Copy is contextually relevant to the audience/channel/tone

- [ ] **12.2.4** Change channel to **Discord**, regenerate
  - Verify: Copy style adapts (may include markdown formatting for Discord)

- [ ] **12.2.5** Change channel to **Email**
  - Verify: Response includes `subject` field (email subject line)

---

## 12.3 Action Agent (AI-Planned On-chain Actions)

**Location:** Campaign pages → "AI Plan" wizard

### Steps

- [ ] **12.3.1** Navigate to a campaign page
  - Verify: "AI Plan" button or wizard trigger visible

- [ ] **12.3.2** Click to open Action Plan wizard
  - Verify: 3-step wizard dialog opens
  - Verify: Step 1: instruction textarea

- [ ] **12.3.3** Enter instruction: `Airdrop 10 SUI to all profiles in the VIP Whales segment`
  - Click **"Generate Plan"**
  - Verify: Loading state while LLM generates plan
  - Verify: Step 2: Plan review card appears with:
    - Target segment name
    - Estimated cost
    - Action type badges (e.g. "airdrop_token")

- [ ] **12.3.4** Review plan, click **"Confirm & Execute"**
  - Verify: Step 3: Execution result
  - Verify: Success message with execution details (or error if dry-run)
  - Note: With `SUI_DRY_RUN=true`, execution returns mock result

### Failure Cases

- [ ] **12.3.5** Enter vague instruction: `Do something nice for users`
  - Verify: Agent attempts to interpret, returns a plan or asks for clarification
  - Verify: No crash

- [ ] **12.3.6** Cancel wizard at step 2 (before execute)
  - Verify: Dialog closes, no action executed
