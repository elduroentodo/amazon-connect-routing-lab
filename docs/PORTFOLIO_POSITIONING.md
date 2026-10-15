# Portfolio positioning

## Project summary

**Amazon Connect Routing Lab** is a bilingual SaaS support-routing sandbox. Its published Connect flow chooses a language, invokes an English or Spanish Lex V2 voice prompt, routes recognized routine intents to an appropriate queue, and sends technical intent through a Node.js Lambda priority check. An unrecognized intent in either language goes to `general-support` for human triage; Lex silence/service errors and lookup errors retain a keypad fallback. The CLI deployment was read back and verified to match the candidate flow.

The Connect-facing Lex alias now targets version 2, which can ask a clarifying question when supported intents overlap. Fictional Lex text-runtime tests confirmed the follow-up and answer resolution in English and Spanish. This is not evidence of an end-to-end phone call.

## Operational pain addressed

- Callers can describe a need in ordinary speech rather than navigating every support category by number.
- Language is selected before voice recognition and queue assignment.
- Technical urgency follows an explicit priority rule instead of an opaque voice-label decision.
- An unrecognized utterance goes to human general-support triage; an unavailable lookup retains the keypad route.
- An ambiguous request can be clarified before choosing a deterministic queue route.

## Honest resume / LinkedIn wording

> Built and published a bilingual Amazon Connect sandbox flow integrating Amazon Lex V2 intent recognition with deterministic queue routing and a synchronous Node.js Lambda priority check. Added bilingual Lex intent clarification, verified through fictional text-runtime dialogues, and promoted it through a versioned alias with a rollback path. Added CLI-based flow generation, structural validation, published-content verification, and rollback copies. Routed unrecognized intents to a human general-support queue while retaining keypad recovery for service or lookup failures. Used fictional data only; no phone number, outside calls, or customer records were involved.

The local TypeScript model additionally demonstrates future callback, audit, and agent-handoff behavior. Do not describe those simulated components as deployed in AWS.

## Claims to avoid

Do **not** say this handled production traffic, successfully recognized speech through an end-to-end Connect call, accessed a real CRM, provided RAG answers, or deployed a knowledge base. No number is attached. The Lambda receives no customer ID in the live flow and returns the safe normal-priority fallback; its fictional urgent case is tested locally.

## Interview talking points

1. **Why set language before Lex?** Connect must invoke the correct locale model; language is a routing input, not merely a prompt translation.
2. **Why keep the Lambda priority check?** Intent tells us the topic, while trusted account/incident context determines urgency. In this sandbox, absent context correctly results in the keypad route.
3. **Why keep DTMF?** Voice recognition and backend lookups can fail. A familiar numeric path allows the caller to continue.
4. **What would be required for real use?** Least-privilege AWS access, approved data, bilingual fallback polish, controlled phone testing, queue staffing, and privacy/cost monitoring.
