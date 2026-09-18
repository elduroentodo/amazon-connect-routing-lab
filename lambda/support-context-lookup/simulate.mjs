import assert from "node:assert/strict";
import { handler } from "./index.mjs";

// These events mirror the Details.Parameters shape configured by an
// Amazon Connect Invoke Lambda block. Every value is fictional.
const scenarios = [
  {
    name: "enterprise technical incident",
    event: {
      Details: {
        Parameters: {
          customerId: "CUST-100",
          language: "es",
          issueType: "technical"
        }
      }
    },
    expected: {
      customerFound: "true",
      plan: "enterprise",
      openIncident: "true",
      language: "es",
      issueType: "technical",
      priority: "urgent"
    }
  },
  {
    name: "standard Spanish billing request",
    event: {
      Details: {
        Parameters: {
          customerId: "CUST-200",
          language: "es",
          issueType: "billing"
        }
      }
    },
    expected: {
      customerFound: "true",
      plan: "standard",
      openIncident: "false",
      language: "es",
      issueType: "billing",
      priority: "normal"
    }
  },
  {
    name: "unknown caller gets a safe fallback",
    event: {
      Details: {
        Parameters: {
          customerId: "CUST-999",
          language: "en",
          issueType: "onboarding"
        }
      }
    },
    expected: {
      customerFound: "false",
      plan: "unknown",
      openIncident: "false",
      language: "en",
      issueType: "onboarding",
      priority: "normal"
    }
  },
  {
    name: "published-flow sandbox fallback",
    event: { Details: { Parameters: {} } },
    expected: {
      customerFound: "false",
      plan: "unknown",
      openIncident: "false",
      language: "en",
      issueType: "onboarding",
      priority: "normal"
    }
  }
];

for (const scenario of scenarios) {
  const result = await handler(scenario.event);
  assert.deepEqual(result, scenario.expected);
  console.log(`✓ ${scenario.name}: ${result.priority}`);
}

console.log("All fictional Amazon Connect Lambda scenarios passed.");
