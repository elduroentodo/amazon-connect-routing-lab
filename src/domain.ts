// These unions limit each value to a known option. In a real contact flow,
// they correspond to IVR menu selections and routing attributes.
export type Language = "es" | "en";
export type IssueType = "technical" | "billing" | "onboarding";
export type Plan = "enterprise" | "standard";
export type Priority = "urgent" | "normal";

export interface IncomingContact {
  contactId: string;
  customerId?: string;
  language: Language;
  issueType: IssueType;
  wantsCallback: boolean;
}

// This is deliberately mock data. A real lookup would read from DynamoDB or a CRM.
export interface CustomerProfile {
  customerId: string;
  plan: Plan;
  hasOpenIncident: boolean;
  preferredLanguage: Language;
}

export interface RouteDecision {
  contactId: string;
  queue: "escalations" | "spanish-support" | "general-support";
  priority: Priority;
  callback: { offered: boolean; simulatedQueuePosition?: number };
  attributesForAgent: Record<string, string>;
  agentHandoff: string;
  auditTrail: string[];
}
