# Deployment walkthrough: bilingual voice intake

This document explains the *published configuration* and the CLI change that added Amazon Lex V2 to the original Connect/Lambda routing lab. It also marks what remains untested. The diagram is redacted and contains no account IDs, phone numbers, or credentials.

![Published voice-routing architecture](assets/published-flow-routing.svg)

## The operational problem

A keypad-only IVR makes every caller translate a problem into a numeric menu. A voice bot can recognize a caller's broad reason for contacting support, while the contact flow keeps queue selection explicit and auditable. We use Lex to recognize *intent*, not to make unsupported claims about account status or urgency. A small Lambda may supply trusted context for a technical incident; if it cannot, the keypad remains available.

## What was verified in AWS

1. The Connect instance had a published, nine-action base flow: welcome prompt → synchronous Lambda → `External.priority` check → escalation or three-option keypad → shared transfer. It also had three queues and an escalation-first routing profile.
2. The Lex V2 alias was available on version 1, with `en_US` and `es_419` enabled. Both locales contained `TechnicalIncident`, `BillingHelp`, `OnboardingHelp`, and `SpeakToAgent`. The alias was associated with the Connect instance.
3. The new flow candidate contained the original nine actions plus five new actions. A local validator checked unique action identifiers, all transition targets, and graph reachability.
4. The CLI voice-flow update completed. A subsequent `describe-contact-flow` reported `PUBLISHED`, 14 actions, and content identical to the candidate.
5. A second, four-target update changed the Lex default and `NoMatchingCondition` routes in both languages from the keypad to `general-support`. AWS again reported `PUBLISHED`, and its live content exactly matched the reviewed candidate. Timeout and service-error targets remained on the keypad.
6. The instance had zero claimed phone numbers. No outside call or end-to-end Connect voice test was made.
7. Later, Lex intent disambiguation was added to both locales, tested with fictional text-runtime dialogues, and promoted through the existing Connect-facing alias as bot version 2. The Connect flow remained published with the same 14 actions. See [Lex clarification walkthrough](LEX_CLARIFICATION.md).

“Published” here means the flow configuration is available inside the AWS instance. It is **not** a production contact center and cannot receive an outside call without a phone number.

## How the flow now works

| Stage | Action | Why it exists |
| --- | --- | --- |
| 1 | Welcome, then “1 English / 2 Español” keypad choice | A deterministic choice tells Connect which Lex language model to use. |
| 2 | Set Connect language to `en-US` or `es-419` | Lex V2 requires the contact language to match its bot locale. |
| 3 | Ask for the support need with the matching Lex voice prompt | The bot classifies the utterance into a supported intent. Version 2 may ask a follow-up when plausible intents overlap. |
| 4a | Billing, onboarding, or human-agent intent → language-appropriate queue | These routine paths need no fictional account lookup. |
| 4b | Technical intent → Lambda → check `External.priority` | Urgency remains a transparent rule based on returned context, not solely on a voice label. |
| 4c | Unknown intent → `general-support` | A human can triage a request the bot cannot classify; this applies to both English and Spanish calls by explicit project choice. |
| 5 | `urgent` → escalation; normal, missing, or Lambda error → keypad menu | Automation must not strand callers when context is insufficient. |
| 6 | Every chosen queue → one shared transfer block | One transfer point keeps the routing change small and reviewable. |

The original three-option keypad remains: `1` Spanish support, `2` urgent technical incident, `3` general support. Language-choice timeout/error, Lex silence or service error, and Lambda normal/error outcomes land there. An **unrecognized Lex intent does not**: it goes straight to `general-support`. The keypad is still English-language, even on a Spanish voice error; that is a known improvement before any real-caller test. Sending an unclear Spanish request to general support may also require a bilingual agent or a later transfer.

The deployed Lambda uses two fictional profiles but receives **no customer ID** from this flow. It therefore returns `priority: normal` for the technical-intent path, and that path reaches the keypad. The urgent branch is wired, but the current published input cannot independently prove it via a live call. The local [`simulate.mjs`](../lambda/support-context-lookup/simulate.mjs) covers the fictional urgent and fallback contracts separately.

## Reproducing the CLI change

The [flow builder](../scripts/build-voice-flow.mjs) makes the **current design** from the original nine-action base flow. It obtains the associated Lex alias through the CLI and refuses to insert voice blocks if the base flow has changed or the blocks already exist. The script changes no AWS resources; it writes two files under git-ignored `.local/`:

- `flow-before-voice.json`: rollback copy of the original published content.
- `flow-voice-candidate.json`: candidate with five additional actions and general-support triage for unknown intent.

With AWS CLI v2 signed in to an appropriately scoped profile, run from the repository root (replace each placeholder with your own resource ID):

```bash
node scripts/build-voice-flow.mjs \
  --profile=YOUR_PROFILE \
  --region=YOUR_REGION \
  --instance-id=YOUR_CONNECT_INSTANCE_ID \
  --flow-id=YOUR_CONTACT_FLOW_ID \
  --bot-id=YOUR_LEX_BOT_ID \
  --alias-id=YOUR_LEX_ALIAS_ID

aws connect update-contact-flow-content \
  --profile YOUR_PROFILE --region YOUR_REGION \
  --instance-id YOUR_CONNECT_INSTANCE_ID \
  --contact-flow-id YOUR_CONTACT_FLOW_ID \
  --content file://.local/flow-voice-candidate.json
```

The second command modifies the existing flow. First review the generated candidate and the intended routing before issuing it. AWS may reject invalid flow JSON; the successful response alone is not enough evidence. Read back `Status` and `Content`, then compare the live content with the candidate (as done for this deployment). Do not commit `.local/`: its files include account-specific ARNs, although they contain no credentials.

If the new flow needs to be rolled back, reapply the saved original content to the **same** flow ID, then read it back again:

```bash
aws connect update-contact-flow-content \
  --profile YOUR_PROFILE --region YOUR_REGION \
  --instance-id YOUR_CONNECT_INSTANCE_ID \
  --contact-flow-id YOUR_CONTACT_FLOW_ID \
  --content file://.local/flow-before-voice.json
```

This rollback command is documented but was **not** run; the published voice flow remains active.

The already-published 14-action voice flow was updated using [the targeted no-match migration](../scripts/route-unknown-lex-to-general.mjs). It wrote `flow-before-general-fallback.json` and `flow-general-fallback-candidate.json` under `.local/`. The only JSON differences were the two Lex default targets and two `NoMatchingCondition` targets. To repeat that migration on a still-unmodified voice flow, run:

```bash
node scripts/route-unknown-lex-to-general.mjs \
  --profile=YOUR_PROFILE \
  --region=YOUR_REGION \
  --instance-id=YOUR_CONNECT_INSTANCE_ID \
  --flow-id=YOUR_CONTACT_FLOW_ID

aws connect update-contact-flow-content \
  --profile YOUR_PROFILE --region YOUR_REGION \
  --instance-id YOUR_CONNECT_INSTANCE_ID \
  --contact-flow-id YOUR_CONTACT_FLOW_ID \
  --content file://.local/flow-general-fallback-candidate.json
```

To reverse **only** this fallback change, use the same update command with `file://.local/flow-before-general-fallback.json`, then read the live flow back. Do not run the migration twice: its guards intentionally reject a flow whose targets have already changed.

## Costs and safety

AWS CLI is only a way to configure AWS; it does not reduce the price of Lex, Connect, Lambda, or telephony usage. This project has no claimed phone number, so it cannot receive outside calls. It uses no real customer data or environment secrets. The CLI session used for this one-off update authenticated as the AWS account's root user; future routine work should use a least-privilege IAM Identity Center or IAM identity. A billing budget is a warning, not a spending cap.

## What is next—and what is not yet built

The voice layer is published and structurally verified, but not end-to-end call-tested. Before using it with callers, improve the Spanish fallback prompt, test both languages and each failure path using a temporary number during a planned window, confirm queue staffing, and inspect logs without storing unnecessary caller data.

A knowledge base or RAG-generated answer layer is **not** part of this deployment. It would need approved source documents, retrieval/grounding tests, answer boundaries, a human handoff, and a separate cost decision. The richer TypeScript simulation in this repository is also not the published Connect flow.

There are two separate ways to add follow-up questions. First, [Lex Assisted NLU and intent disambiguation](https://docs.aws.amazon.com/lexv2/latest/dg/generative-intent-disambiguation.html) can ask a clarifying question when configured intents overlap. That first option is now enabled and text-tested in both languages; the exact change and its limits are in [Lex clarification walkthrough](LEX_CLARIFICATION.md). Second, [Connect agentic self-service](https://docs.aws.amazon.com/connect/latest/adminguide/agentic-self-service.html) supports multi-turn conversation, tools, and knowledge-based answers. That agentic/RAG option has **not** been enabled in this lab; it is not a simple swap of the current Lex block for an arbitrary LLM.
