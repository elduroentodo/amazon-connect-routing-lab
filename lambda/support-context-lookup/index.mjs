// Fictional, in-code data for a portfolio demonstration only.
// Do not replace this with customer data in a production environment.
const PROFILES = {
  "CUST-100": { plan: "enterprise", hasOpenIncident: true },
  "CUST-200": { plan: "standard", hasOpenIncident: false }
};

const supportedIssues = new Set(["technical", "billing", "onboarding"]);

export const handler = async (event = {}) => {
  // Amazon Connect passes configured parameters inside Details.Parameters.
  // Direct Lambda tests can pass the same fields at the top level.
  const input = event.Details?.Parameters ?? event;
  const customerId = input.customerId ?? "";
  const language = input.language === "es" ? "es" : "en";
  const issueType = supportedIssues.has(input.issueType)
    ? input.issueType
    : "onboarding";
  const customer = PROFILES[customerId];

  const priority =
    customer?.plan === "enterprise" &&
    customer.hasOpenIncident &&
    issueType === "technical"
      ? "urgent"
      : "normal";

  // Connect uses these simple return values as contact attributes.
  return {
    customerFound: String(Boolean(customer)),
    plan: customer?.plan ?? "unknown",
    openIncident: String(customer?.hasOpenIncident ?? false),
    language,
    issueType,
    priority
  };
};
