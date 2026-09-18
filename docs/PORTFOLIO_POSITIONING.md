# Portfolio positioning

## Project summary

**Amazon Connect Routing Lab** is a bilingual SaaS support-routing portfolio project. Its published Amazon Connect sandbox flow invokes a Node.js Lambda lookup after its welcome prompt, checks the returned `priority` value, and sends an `urgent` result to escalation. Normal, missing, and Lambda-error outcomes retain the Spanish, urgent-technical, and general-support keypad paths. The Lambda uses only fictional data and safe fallback behavior; the TypeScript model demonstrates the richer next layer of callbacks and agent-ready handoff.

## Operational pain relieved

- Callers do not need to repeat basic context after reaching an agent.
- High-impact technical incidents are not handled like ordinary requests.
- Language is recognized early instead of being discovered after transfer.
- A missing profile does not strand a customer in the IVR.
- Supervisors can see why a routing decision happened.

## Honest resume / LinkedIn wording

Use this wording:

> Built and published an Amazon Connect sandbox routing flow for bilingual SaaS support, with Spanish, urgent-technical, and general-support queues plus priority agent routing. Deployed and console-tested a Node.js Lambda customer-context lookup using fictional data and safe fallback behavior, then integrated it as a synchronous step and `priority` decision in the published flow. Built a TypeScript model for the richer DynamoDB-style enrichment, callbacks, agent handoff context, and auditable routing decisions.

Do **not** say that you managed production calls, processed real customer records, deployed DynamoDB, callbacks, or an agent workspace. The Amazon Connect configuration is published in a sandbox, but no phone number is attached and no live calls have been made. The flow does evaluate its fictional Lambda `priority` result, but its current no-identifier sandbox path deliberately uses the normal fallback and keypad menu.

## Interview talking points

1. **Why Lambda before the queue?** The lookup supplies entitlement and incident context required to assign a fair priority.
2. **Why retain a callback position?** A callback should reduce customer effort, not penalize a customer for leaving the phone queue.
3. **What happens if data is unavailable?** The Lambda-error and normal-fallback paths preserve the keypad menu, so a caller can still choose support without being trapped by a lookup failure.
4. **How would this become live?** Add a minimal approved data source, pass only necessary contact context to the Lambda, retain the validated returned-attribute rule, map selected attributes to the agent workspace, and test with a temporary number.
