import { IncomingContact } from "./domain.js";
import { routeContact } from "./route-contact.js";

const testContacts: IncomingContact[] = [
  {
    contactId: "demo-001",
    customerId: "CUST-100",
    language: "es",
    issueType: "technical",
    wantsCallback: false
  },
  {
    contactId: "demo-002",
    customerId: "CUST-200",
    language: "es",
    issueType: "billing",
    wantsCallback: true
  },
  {
    contactId: "demo-003",
    language: "en",
    issueType: "onboarding",
    wantsCallback: false
  }
];

for (const contact of testContacts) {
  const decision = routeContact(contact);
  console.log("\n--- Contact decision ---");
  console.log(JSON.stringify(decision, null, 2));
}
