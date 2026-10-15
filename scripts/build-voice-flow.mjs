import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const localDir = join(dirname(fileURLToPath(import.meta.url)), "..", ".local");

function awsJson(profile, region, ...args) {
  return JSON.parse(execFileSync("aws", [...args, "--profile", profile, "--region", region, "--output", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }));
}

function condition(value, nextAction) {
  return { NextAction: nextAction, Condition: { Operator: "Equals", Operands: [value] } };
}

function fallbackErrors(nextAction, includeTimeout = false) {
  return [
    ...(includeTimeout ? [{ NextAction: nextAction, ErrorType: "InputTimeLimitExceeded" }] : []),
    { NextAction: nextAction, ErrorType: "NoMatchingCondition" },
    { NextAction: nextAction, ErrorType: "NoMatchingError" }
  ];
}

function languageAction(identifier, languageCode, nextAction) {
  return {
    Identifier: identifier,
    Type: "UpdateContactData",
    Parameters: { LanguageCode: languageCode, TargetContact: "Current" },
    Transitions: {
      NextAction: nextAction,
      Errors: [{ NextAction: "Choose routing path", ErrorType: "NoMatchingError" }]
    }
  };
}

function lexAction(identifier, aliasArn, prompt, routineQueue) {
  return {
    Identifier: identifier,
    Type: "ConnectParticipantWithLexBot",
    Parameters: { Text: prompt, LexV2Bot: { AliasArn: aliasArn } },
    Transitions: {
      NextAction: "Choose routing path",
      Conditions: [
        condition("TechnicalIncident", "Lookup support context"),
        condition("BillingHelp", routineQueue),
        condition("OnboardingHelp", routineQueue),
        condition("SpeakToAgent", routineQueue)
      ],
      Errors: fallbackErrors("Choose routing path", true)
    }
  };
}

export function validateFlow(flow) {
  const ids = flow.Actions.map(({ Identifier }) => Identifier);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate action identifier");
  const known = new Set(ids);
  if (!known.has(flow.StartAction)) throw new Error("StartAction is missing");
  for (const action of flow.Actions) {
    const transitions = action.Transitions ?? {};
    for (const target of [transitions.NextAction, ...(transitions.Conditions ?? []).map(x => x.NextAction), ...(transitions.Errors ?? []).map(x => x.NextAction)]) {
      if (target && !known.has(target)) throw new Error(`${action.Identifier} points to missing action ${target}`);
    }
  }
  const seen = new Set();
  const queue = [flow.StartAction];
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const transitions = flow.Actions.find(x => x.Identifier === id).Transitions ?? {};
    queue.push(...[transitions.NextAction, ...(transitions.Conditions ?? []).map(x => x.NextAction), ...(transitions.Errors ?? []).map(x => x.NextAction)].filter(Boolean));
  }
  const unreachable = ids.filter(id => !seen.has(id));
  if (unreachable.length) throw new Error(`Unreachable actions: ${unreachable.join(", ")}`);
}

export function buildVoiceFlow(base, aliasArn) {
  const flow = structuredClone(base);
  const required = ["Welcome and explain options", "Choose routing path", "Lookup support context", "Set general support queue", "Set Spanish support queue"];
  for (const id of required) {
    if (!flow.Actions.some(action => action.Identifier === id)) throw new Error(`Base flow is missing ${id}`);
  }
  if (flow.Actions.some(action => action.Identifier === "Choose spoken language")) {
    throw new Error("Voice blocks already exist; refusing to insert them twice");
  }
  const welcome = flow.Actions.find(action => action.Identifier === "Welcome and explain options");
  if (welcome.Transitions.NextAction !== "Lookup support context") {
    throw new Error("Welcome branch changed since this script was written; review before deploying");
  }
  welcome.Transitions.NextAction = "Choose spoken language";
  flow.Actions.push(
    {
      Identifier: "Choose spoken language",
      Type: "GetParticipantInput",
      Parameters: {
        StoreInput: "False",
        InputTimeLimitSeconds: "5",
        Text: "For English, press 1. Para español, oprima 2."
      },
      Transitions: {
        NextAction: "Choose routing path",
        Conditions: [condition("1", "Set English language"), condition("2", "Set Spanish language")],
        Errors: fallbackErrors("Choose routing path", true)
      }
    },
    languageAction("Set English language", "en-US", "Recognize English intent"),
    languageAction("Set Spanish language", "es-419", "Recognize Spanish intent"),
    lexAction("Recognize English intent", aliasArn,
      "Please briefly tell me how I can help. You can say technical incident, billing help, onboarding help, or speak to an agent.",
      "Set general support queue"),
    lexAction("Recognize Spanish intent", aliasArn,
      "Por favor, dime brevemente cómo puedo ayudarte. Puedes decir incidente técnico, ayuda con facturación, ayuda para empezar, o quiero hablar con un agente.",
      "Set Spanish support queue")
  );
  flow.Metadata ??= {};
  flow.Metadata.ActionMetadata ??= {};
  for (const [id, x, y] of [
    ["Choose spoken language", 180, 100],
    ["Set English language", 420, -140],
    ["Set Spanish language", 420, 100],
    ["Recognize English intent", 680, -140],
    ["Recognize Spanish intent", 680, 100]
  ]) {
    flow.Metadata.ActionMetadata[id] = { position: { x, y }, isFriendlyName: true };
  }
  validateFlow(flow);
  return flow;
}

function main() {
  const opts = Object.fromEntries(process.argv.slice(2).map(arg => {
    const split = arg.indexOf("=");
    if (!arg.startsWith("--") || split < 0) throw new Error(`Expected --name=value, got ${arg}`);
    return [arg.slice(2, split), arg.slice(split + 1)];
  }));
  for (const name of ["profile", "region", "instance-id", "flow-id", "bot-id", "alias-id"]) {
    if (!opts[name]) throw new Error(`Missing --${name}=...`);
  }
  const { profile, region } = opts;
  const alias = awsJson(profile, region, "lexv2-models", "describe-bot-alias", "--bot-id", opts["bot-id"], "--bot-alias-id", opts["alias-id"]);
  if (alias.botAliasStatus !== "Available" || alias.botVersion === "DRAFT") throw new Error("Lex alias is not a stable, available version");
  for (const locale of ["en_US", "es_419"]) {
    if (!alias.botAliasLocaleSettings?.[locale]?.enabled) throw new Error(`Lex locale ${locale} is not enabled`);
    const intents = awsJson(profile, region, "lexv2-models", "list-intents", "--bot-id", opts["bot-id"], "--bot-version", alias.botVersion, "--locale-id", locale);
    const names = new Set(intents.intentSummaries?.map(intent => intent.intentName));
    for (const name of ["TechnicalIncident", "BillingHelp", "OnboardingHelp", "SpeakToAgent"]) {
      if (!names.has(name)) throw new Error(`Lex locale ${locale} is missing intent ${name}`);
    }
  }
  const associated = awsJson(profile, region, "connect", "list-bots", "--instance-id", opts["instance-id"], "--lex-version", "V2");
  const suffix = `:bot-alias/${opts["bot-id"]}/${opts["alias-id"]}`;
  const aliasArn = associated.LexBots?.map(item => item.LexV2Bot?.AliasArn).find(arn => arn?.endsWith(suffix));
  if (!aliasArn) throw new Error("Lex alias is not associated with this Connect instance");
  const described = awsJson(profile, region, "connect", "describe-contact-flow", "--instance-id", opts["instance-id"], "--contact-flow-id", opts["flow-id"]);
  if (described.ContactFlow?.Status !== "PUBLISHED") throw new Error("Expected an existing published flow");
  const before = JSON.parse(described.ContactFlow.Content);
  const after = buildVoiceFlow(before, aliasArn);
  mkdirSync(localDir, { recursive: true, mode: 0o700 });
  const backupPath = join(localDir, "flow-before-voice.json");
  const candidatePath = join(localDir, "flow-voice-candidate.json");
  writeFileSync(backupPath, JSON.stringify(before), { mode: 0o600 });
  writeFileSync(candidatePath, JSON.stringify(after), { mode: 0o600 });
  console.log(`Validated ${before.Actions.length} existing + 5 new actions; all branches have targets.`);
  console.log(`Local rollback copy: ${backupPath}`);
  console.log(`Deployment candidate: ${candidatePath}`);
  console.log("No AWS resources were changed by this script.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
