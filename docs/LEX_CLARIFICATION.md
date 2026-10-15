# Lex clarification: ask once before deterministic routing

This is the **deployed Lex configuration** for the bilingual Amazon Connect sandbox. It adds a follow-up question when Lex sees a plausible overlap between supported intents. It does not add a knowledge base, generate a support answer, or let an AI model choose an AWS queue directly.

## The problem and the design

“I need help with a charge while setting up my account” could be about billing or onboarding. Immediately guessing a queue may send the caller to the wrong team. Lex now asks which of those topics the caller meant, returns the selected intent, and lets the existing Connect flow make the final queue decision.

```text
Caller speaks → Lex classifies or clarifies → intent returned to Connect
                                              ├─ billing/onboarding/agent → support queue
                                              └─ technical → Lambda priority check → route
```

The four existing intents are `TechnicalIncident`, `BillingHelp`, `OnboardingHelp`, and `SpeakToAgent`. An **intent** is a category, not an answer or an urgency score. The **confidence threshold** is the point below which Lex can ask its Assisted NLU layer to reconsider the classification. **Intent disambiguation** presents the most plausible supported intents to the caller. The **alias** is a stable name used by Connect; it now points to immutable bot version 2. Version 1 remains available to roll back.

## What changed in AWS

1. In the Lex `DRAFT` bot, enabled Assisted NLU in `Fallback` mode and intent disambiguation for `en_US` and `es_419`. The maximum number of offered intents is three. The configured preambles are “To route you correctly, please choose:” and “Para dirigirte al equipo correcto, elige:”. Lex appends the candidate intent display names.
2. Raised each locale's `nluIntentConfidenceThreshold` from `0.4` to `0.85`. This was a small-sample tuning decision, **not** a validated optimal threshold. A clearly recognized intent still goes straight through; an overlapping request may trigger clarification.
3. Rebuilt both locales and tested the draft with fictional `recognize-text` requests, including a second utterance in the **same session** to answer the question. A new session would lose the dialogue context.
4. Created immutable bot version 2 from both built draft locales, then changed the existing `connect-sandbox` alias from version 1 to version 2. Both locales remain enabled. The published 14-action Connect flow still references this same alias and did not require editing.
5. Read back the alias, the Connect/Lex association, and the published flow. Repeated the bilingual dialogue against the **live alias**, not only the test alias.

## Observed tests

| Locale | Fictional first utterance | Observed Lex behavior | Follow-up in same session | Result |
| --- | --- | --- | --- | --- |
| English | “I need help with a charge while setting up my account” | Asked whether the caller needed onboarding or billing support. | “Billing support” | `BillingHelp` |
| Spanish | “Necesito ayuda con un cobro mientras configuro mi cuenta” | Asked whether the caller needed onboarding or billing support. | “Facturación” | `BillingHelp` |
| English | “I need a copy of my invoice” | No clarification. | — | `BillingHelp` |
| Spanish | “Necesito una copia de mi factura” | No clarification. | — | `BillingHelp` |

The follow-up examples were also repeated successfully after alias promotion. Candidate order can vary. This feature does **not** promise to clarify every vague sentence: Lex can still choose a high-confidence intent without asking, and unfamiliar requests may become `FallbackIntent`. The existing Connect unknown-intent path goes to `general-support` for both languages; a Lex silence or service error uses the keypad. Routing, prompts, and voice turn-taking still need an actual phone-call test before real use.

## Reproduce the configuration safely

Use your own AWS profile, region, bot ID, and alias ID; none are published here. Inspect the current draft configuration before changing it. The following shows the key CLI settings for English; repeat with `es_419` and its Spanish message. Run from a shell with an authenticated, appropriately scoped AWS CLI profile.

```bash
aws lexv2-models update-bot-locale \
  --profile YOUR_PROFILE --region YOUR_REGION \
  --bot-id YOUR_BOT_ID --bot-version DRAFT --locale-id en_US \
  --nlu-intent-confidence-threshold 0.85 \
  --generative-ai-settings '{"runtimeSettings":{"nluImprovement":{"enabled":true,"assistedNluMode":"Fallback","intentDisambiguationSettings":{"enabled":true,"maxDisambiguationIntents":3,"customDisambiguationMessage":"To route you correctly, please choose:"}}}}'

aws lexv2-models build-bot-locale \
  --profile YOUR_PROFILE --region YOUR_REGION \
  --bot-id YOUR_BOT_ID --bot-version DRAFT --locale-id en_US
```

Wait until **both** locales report `Built`; `ReadyExpressTesting` supports only limited utterance testing. Test one ambiguous first utterance and its answer with the **same** `--session-id`. Then test a clear utterance that should bypass clarification. Only after both languages pass, create a new immutable version and update the Connect-facing alias:

```bash
aws lexv2-models create-bot-version \
  --profile YOUR_PROFILE --region YOUR_REGION \
  --bot-id YOUR_BOT_ID \
  --bot-version-locale-specification '{"en_US":{"sourceBotVersion":"DRAFT"},"es_419":{"sourceBotVersion":"DRAFT"}}'

aws lexv2-models update-bot-alias \
  --profile YOUR_PROFILE --region YOUR_REGION \
  --bot-id YOUR_BOT_ID --bot-alias-id YOUR_ALIAS_ID \
  --bot-alias-name YOUR_ALIAS_NAME --bot-version YOUR_NEW_VERSION \
  --bot-alias-locale-settings '{"en_US":{"enabled":true},"es_419":{"enabled":true}}'
```

Check that the version and alias both report `Available`, and test against the real alias. Preserve any existing alias locale hooks, logs, or other settings if your own bot has them; this lab's alias has no such hooks or logs. If the new version misroutes calls, point **the same alias** back to version 1 using `update-bot-alias` with `--bot-version 1`, the existing alias name, and both locale settings, then retest. Do not delete the older version first.

## Scope, cost, and next experiment

The proof here is Lex text-runtime dialogue plus configuration readback. There is no phone number, outside voice call, RAG knowledge base, generated customer answer, or production traffic. Lex requests can incur AWS usage charges; using the CLI does not make the service free. A budget alarm warns but does not stop spend.

Before adding real callers, test many paraphrases and out-of-scope requests in both languages, check whether the threshold creates too many unnecessary questions, verify Spanish pronunciation and interruption handling over a temporary number, and ensure a staffed human fallback. A later RAG layer would require vetted source documents, grounded answer tests, privacy controls, cost review, and a clear human-handoff rule.

References: [AWS intent disambiguation](https://docs.aws.amazon.com/lexv2/latest/dg/generative-intent-disambiguation.html), [Assisted NLU](https://docs.aws.amazon.com/lexv2/latest/dg/assisted-nlu.html), and [bot versioning and aliases](https://docs.aws.amazon.com/lexv2/latest/dg/versions-aliases.html).
