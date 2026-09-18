import { lookupCustomer } from "./customer-directory.js";
import { IncomingContact, RouteDecision } from "./domain.js";

/**
 * This function is the local equivalent of the decision-making part of an
 * Amazon Connect contact flow. It receives IVR answers, enriches the contact
 * with customer context, and returns routing attributes and an agent handoff.
 */
export function routeContact(contact: IncomingContact): RouteDecision {
  const auditTrail = [
    `Contact ${contact.contactId} entered the ${contact.language} IVR.`,
    `Caller selected ${contact.issueType}.`
  ];
  const customer = lookupCustomer(contact.customerId);

  if (customer) {
    auditTrail.push(`Mock customer profile ${customer.customerId} found.`);
  } else {
    auditTrail.push("No customer profile found; using a safe default route.");
  }

  // A business rule: an enterprise customer with an active technical incident
  // should not wait in the ordinary queue.
  const isUrgentEscalation =
    customer?.plan === "enterprise" &&
    customer.hasOpenIncident &&
    contact.issueType === "technical";

  const queue = isUrgentEscalation
    ? "escalations"
    : contact.language === "es"
      ? "spanish-support"
      : "general-support";
  const priority = isUrgentEscalation ? "urgent" : "normal";

  auditTrail.push(`Assigned queue: ${queue}; priority: ${priority}.`);

  const callback = contact.wantsCallback
    ? { offered: true, simulatedQueuePosition: isUrgentEscalation ? 1 : 3 }
    : { offered: false };

  if (callback.offered) {
    auditTrail.push(
      `Callback requested; simulated queue position retained: ${callback.simulatedQueuePosition}.`
    );
  }

  // These key/value pairs are the information an agent needs in the CCP.
  // In Amazon Connect, a contact flow would set them as contact attributes.
  const attributesForAgent = {
    language: contact.language,
    issueType: contact.issueType,
    plan: customer?.plan ?? "unknown",
    openIncident: String(customer?.hasOpenIncident ?? false),
    priority
  };

  const agentHandoff = isUrgentEscalation
    ? "Enterprise customer with an active technical incident. Confirm the incident status and take ownership of the escalation."
    : `Customer needs ${contact.issueType} support. Continue in ${contact.language === "es" ? "Spanish" : "English"} and confirm the account context.`;

  return {
    contactId: contact.contactId,
    queue,
    priority,
    callback,
    attributesForAgent,
    agentHandoff,
    auditTrail
  };
}
