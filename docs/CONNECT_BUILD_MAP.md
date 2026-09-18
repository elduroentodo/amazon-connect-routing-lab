# Amazon Connect implementation map

This document distinguishes the verified Amazon Connect sandbox configuration from the local TypeScript model for later customer-context enrichment. It is intentionally explicit about what has and has not run in AWS.

## Verified sandbox deployment

| Capability | Verified configuration | Boundary |
| --- | --- | --- |
| Amazon Connect flow | A published inbound flow presents a three-option DTMF menu: Spanish support, urgent technical incident, or general support. | No phone number is attached, so it cannot receive outside calls. |
| Queues | `escalations`, `spanish-support`, and `general-support` are configured. | They contain no customer contacts. |
| Queue selection | A successful Lambda result with `External.priority = urgent` goes directly to the escalation queue. Normal, missing, and Lambda-error outcomes preserve the three-option keypad menu; each menu option then sets its working queue and uses the shared transfer block. | No customer ID is passed in this sandbox, so the deployed flow currently receives the normal fallback and follows the keypad-menu path. |
| Safe failure handling | Prompt and queue-setting errors lead to a Disconnect block. | This is a safe termination, not a customer-facing recovery message. |
| Agent routing | One routing profile gives escalation work the highest priority, then Spanish and general support, with one voice contact at a time. | It has not been exercised by a live call. |
| AWS Lambda lookup | A Node.js function is deployed with two fictional profiles and a safe fallback response. A console invocation succeeded with the default fictional sample event; the function is approved by the Connect instance and is invoked synchronously after the welcome prompt. Its successful response feeds a published check of `External.priority`; only `urgent` bypasses the keypad to escalation. | No customer ID is passed in this sandbox, so the live flow would use the safe normal fallback and reach the keypad menu. It has no DynamoDB dependency and has not been exercised by an outside call. |

## Contact-flow sequence

| Step | Amazon Connect capability | Local equivalent | Operational purpose |
| --- | --- | --- | --- |
| 1 | Inbound phone number and contact flow | `IncomingContact` | Starts a new support interaction. A flow exists, but no phone number is attached. |
| 2 | Welcome prompt | — | Explains the support-routing lab before the context lookup. |
| 3 | Invoke AWS Lambda | `lookupCustomer()` | The handler is deployed, console-tested, approved by the Connect instance, and invoked synchronously after the welcome prompt. Its error branch preserves access to the keypad menu. |
| 4 | Check contact attributes | `isUrgentEscalation` | The published rule checks `External.priority = urgent`; that branch consistently assigns the escalation queue. |
| 5 | Prompt + customer input | `language` and `issueType` | The no-match fallback preserves the three menu choices through DTMF. |
| 6 | Transfer to queue | `queue` | Sends the contact to escalations, Spanish support, or general support. |
| 7 | Queued callback configuration | `callback` | Lets a caller request a callback while preserving the simulated queue position. |
| 8 | Agent workspace context | `agentHandoff` | Gives the agent a reason, priority, and recommended opening. |
| 9 | Contact-flow logs | `auditTrail` | Explains how and why the contact was routed. |

## Routing policy

```text
IF plan = enterprise
AND there is an open incident
AND the issue is technical
THEN queue = escalations and priority = urgent

ELSE IF language = Spanish
THEN queue = spanish-support

ELSE queue = general-support
```

The policy deliberately uses a safe default: a missing customer profile does not block the caller. The contact is routed to general support, and the audit trail records the failed lookup for follow-up.

## Lambda input and output contract

The Lambda handler accepts configured Connect parameters beneath `Details.Parameters` and returns a flat object of strings. That matches the flow block's **STRING MAP** response validation. The published flow checks the returned `External.priority` value and sends `urgent` to the escalation queue.

The published sandbox flow sends no customer identifier, so the deployed handler deliberately uses the normal-priority fallback and follows the no-match keypad-menu path. The local [`simulate.mjs`](../lambda/support-context-lookup/simulate.mjs) runner proves the fictional enterprise, standard, unknown-caller, and no-parameter cases before any future approved data source is connected.

## Data design

Only these fictional fields are used:

| Attribute | Why it is needed | Safe handling rule |
| --- | --- | --- |
| Customer ID | Looks up the mock profile | Use fictional IDs in demos; do not log real account identifiers. |
| Language | Selects a suitable support queue | Treat as service-preference context. |
| Issue type | Distinguishes technical, billing, and onboarding work | Do not include free-form sensitive descriptions in the routing log. |
| Plan | Applies the support entitlement rule | Store only the minimum tier label. |
| Open incident | Identifies a possible escalation | Record a boolean status, not incident details. |

## Next integration and migration checklist

When a funded AWS environment is available, the implementation sequence is:

1. Replace the in-code fictional profiles with a minimal approved data source only when a real approved use case requires it.
2. Pass only the necessary approved context to the Lambda and keep the published `priority` check as the explicit routing criterion.
3. Show approved attributes to the agent in the Contact Control Panel or an approved agent workspace integration.
4. Claim a test number only for the scheduled demo day; release it after testing.
5. Enable only the necessary logs and remove or mask personal data before storing them.

## Design decisions worth explaining in an interview

- The lookup happens before routing because priority is an account-context decision, not merely an IVR-menu decision.
- Queues describe the work; routing rules decide which work is appropriate for this contact.
- The fallback route protects customer experience when a lookup fails.
- Agent context is separated from the IVR so the agent can start with an informed, human conversation.
