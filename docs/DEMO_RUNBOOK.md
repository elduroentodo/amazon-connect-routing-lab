# Demo runbook

Use this runbook to record a short, repeatable portfolio video or to explain the project in an interview. Every scenario uses fictional data and runs locally; the first step verifies the published Amazon Connect sandbox configuration and its Lambda-enabled flow.

## Preparation

1. In Amazon Connect, open the published `support-intake-routing` flow and show the welcome prompt flowing into `Lookup support context`. Show Lambda success flowing into `Check priority is urgent`, where `urgent` goes to escalation and no match goes to the three-option keypad menu; show the Lambda-error branch also going to the menu. Show the menu paths converging on the shared transfer-to-queue block. Do not claim a phone number or place a call.
2. In AWS Lambda, open `support-context-lookup` and show the successful console test. The built-in sample intentionally returns the safe fallback (`customerFound: false`, `priority: normal`), which is also the expected sandbox behavior when no customer ID is passed from the flow.
3. From the project folder, run:

```bash
npm install
npm run simulate
npm run agent-preview
npm run simulate:lambda
```

## Scenario 1 — urgent enterprise incident

**Input:** `CUST-100`, Spanish, technical support, active incident.

**Expected result:** The route is `escalations` with `urgent` priority. The handoff tells the agent to confirm the incident status and take ownership.

**What it proves:** Priority routing is based on customer context, not the caller’s claim alone.

## Scenario 2 — standard Spanish billing request with callback

**Input:** `CUST-200`, Spanish, billing, callback requested.

**Expected result:** The route is `spanish-support`, normal priority, with a simulated retained queue position of `3`.

**What it proves:** Language routing and callback handling are separate, testable responsibilities.

## Scenario 3 — unknown English caller

**Input:** No customer ID, English, onboarding.

**Expected result:** The route is `general-support`, normal priority. The audit trail records that no profile was found.

**What it proves:** The system fails safely: one unavailable dependency does not disconnect or trap a customer.

## Suggested 90-second video structure

1. Explain the operational pain in one sentence.
2. Show the published Connect flow, its three queues, and the routing profile before showing `CONNECT_BUILD_MAP.md`.
3. Run the Lambda scenarios to show the Connect-shaped event and its safe fallback.
4. Run the three TypeScript simulation scenarios.
5. Run the agent-workspace preview for the escalation case.
6. Close with the honest boundary: “The Amazon Connect flow is published in a sandbox, and the Lambda lookup is deployed, console-tested, and invoked synchronously after the welcome prompt using fictional data. A published check sends `priority = urgent` to escalation; the no-identifier sandbox fallback and Lambda-error paths retain the keypad menu. Agent-handoff scenarios are local TypeScript evidence. No live calls or customer data were used.”
