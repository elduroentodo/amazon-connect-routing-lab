# Demo runbook

Use this runbook to record a short, repeatable portfolio video or to explain the project in an interview. Every scenario uses fictional data and runs locally; the first step shows the published Connect/Lex/Lambda sandbox configuration. No outside call has been made.

## Preparation

1. In Amazon Connect, open the published `support-intake-routing` flow. Show the language choice, `en-US`/`es-419` settings, English/Spanish Lex voice steps, technical-intent Lambda path, and keypad fallback. Show that routine intents choose a language-appropriate queue and all queue paths share one transfer block. Do not claim an end-to-end call test.
2. In AWS Lambda, open `support-context-lookup` and show the successful console test. The built-in sample intentionally returns the safe fallback (`customerFound: false`, `priority: normal`), which is also the expected sandbox behavior when a technical-intent path sends no customer ID.
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
6. Close with the honest boundary: “The Connect flow and Lex voice integration are published in a sandbox and the Lambda lookup is deployed using fictional data. The published content was verified after a CLI update, but no phone number or end-to-end call test was used. The current no-identifier Lambda path returns normal priority and keeps the keypad fallback. Agent-handoff scenarios are local TypeScript evidence, not deployed AWS features.”
