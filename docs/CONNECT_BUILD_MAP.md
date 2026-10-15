# Amazon Connect implementation map

This map separates the verified AWS sandbox from the richer local TypeScript simulation. “Published” means the Connect flow configuration is active in the instance; it does **not** mean a phone number or real caller is connected.

## Verified sandbox deployment

| Capability | Verified configuration | Boundary |
| --- | --- | --- |
| Connect flow | A published, 14-action inbound flow starts with a bilingual language choice, sets `en-US` or `es-419`, and invokes a Lex V2 voice prompt. Its content was read back from AWS and matched the CLI candidate. | No claimed number and no end-to-end call test. |
| Lex V2 | A stable version-1 alias has both locales enabled. Both locales contain `TechnicalIncident`, `BillingHelp`, `OnboardingHelp`, and `SpeakToAgent`; the alias is associated with Connect. | Voice recognition was tested in Lex previously, not through an outside Connect call. No generative answer or RAG component is deployed. |
| Intent routing | Billing, onboarding, and agent requests select `general-support` for English or `spanish-support` for Spanish. Technical intent invokes Lambda and checks its returned priority. | The fallback keypad is the original English-language three-option prompt. |
| Priority decision | `External.priority = urgent` selects `escalations`; other results or Lambda errors go to the original three-option keypad. | The flow passes no customer ID, so the deployed Lambda returns `normal` on this path. The urgent branch is present but cannot be exercised by that input alone. |
| Queues and routing profile | `escalations`, `spanish-support`, and `general-support` exist; the routing profile prioritizes escalation and permits one voice contact at a time. | No live contact has entered a queue. |
| Lambda | The Node.js handler uses two fictional profiles and a flat string-map response. | No CRM, DynamoDB, real customer data, secrets, or production lookup. |
| Safe fallback | Language-choice timeout/error, Lex no-match/error, and Lambda error lead to the keypad menu. Queue-setting errors lead to safe disconnect. | A safe disconnect is not a customer-facing recovery experience. |

## Contact-flow sequence

```text
Welcome
  └─ Choose language: 1 English / 2 Español
       ├─ Set en-US → Lex English ─┬─ TechnicalIncident → Lambda → urgent? → escalations
       │                           │                            └─ otherwise → keypad
       │                           └─ billing/onboarding/agent → general-support
       └─ Set es-419 → Lex Spanish ┬─ TechnicalIncident → same Lambda decision
                                   └─ billing/onboarding/agent → spanish-support

Language/voice errors or unmatched intent → keypad:
  1 spanish-support / 2 escalations / 3 general-support

Every chosen queue → shared TransferContactToQueue block
```

The language setting matters because Connect must invoke the Lex locale that matches the caller’s chosen language. The Lex intent supplies a *category*, not a trusted urgency assessment. The Lambda and explicit `External.priority` comparison retain the deterministic escalation rule.

## Lambda contract and limits

The handler reads optional parameters beneath `Details.Parameters` and returns a flat object of strings. The published Connect block uses **STRING MAP** validation and checks the `priority` field from its `External` result namespace. In this sandbox, no customer identifier is passed. That deliberately produces `priority: normal` and sends the technical caller to the keypad rather than inventing an entitlement or incident.

The local [`simulate.mjs`](../lambda/support-context-lookup/simulate.mjs) runner proves fictional urgent, standard, unknown-caller, and no-parameter cases. These local cases must not be presented as live Connect-call evidence.

## Next integration steps

1. Use an approved minimal customer-context source, passing only the information necessary to assess priority.
2. Add a better bilingual fallback prompt and test every language and error branch through a temporary number during a controlled window.
3. Map approved context to an agent workspace, with data retention and access controls.
4. Replace the current root-user CLI session with a least-privilege identity before routine administration.
5. Treat knowledge-base/RAG answers as a separate future feature: choose sources, retrieval limits, answer grounding, and human handoff before enabling it for callers.

The reproducible build and rollback procedure is in [Deployment walkthrough](DEPLOYMENT_WALKTHROUGH.md).
