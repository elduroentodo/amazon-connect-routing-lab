import { routeContact } from "./route-contact.js";

// This prints the information an agent should receive after the IVR and
// customer lookup have finished. It is a local stand-in for an Amazon Connect
// agent workspace / screen-pop integration, not a copy of the AWS interface.
const decision = routeContact({
  contactId: "demo-agent-preview",
  customerId: "CUST-100",
  language: "es",
  issueType: "technical",
  wantsCallback: false
});

console.log("\n=== Agent workspace preview ===");
console.log(`Queue: ${decision.queue}`);
console.log(`Priority: ${decision.priority}`);
console.log(`Language: ${decision.attributesForAgent.language}`);
console.log(`Plan: ${decision.attributesForAgent.plan}`);
console.log(`Open incident: ${decision.attributesForAgent.openIncident}`);
console.log(`\nRecommended opening:\n${decision.agentHandoff}`);
console.log("\nWhy the call reached this agent:");
for (const event of decision.auditTrail) {
  console.log(`- ${event}`);
}
