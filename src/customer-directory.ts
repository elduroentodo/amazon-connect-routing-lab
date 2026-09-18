import { CustomerProfile } from "./domain.js";

// Think of this Map as a tiny, in-memory DynamoDB table for development.
// The keys and values are fictional; never put real customer data in a portfolio demo.
const profiles = new Map<string, CustomerProfile>([
  [
    "CUST-100",
    {
      customerId: "CUST-100",
      plan: "enterprise",
      hasOpenIncident: true,
      preferredLanguage: "es"
    }
  ],
  [
    "CUST-200",
    {
      customerId: "CUST-200",
      plan: "standard",
      hasOpenIncident: false,
      preferredLanguage: "es"
    }
  ],
  [
    "CUST-300",
    {
      customerId: "CUST-300",
      plan: "standard",
      hasOpenIncident: false,
      preferredLanguage: "en"
    }
  ]
]);

// In AWS, this would be the responsibility of a Lambda function invoked by a contact flow.
export function lookupCustomer(customerId: string | undefined): CustomerProfile | undefined {
  return customerId ? profiles.get(customerId) : undefined;
}
