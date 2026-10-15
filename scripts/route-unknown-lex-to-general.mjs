import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateFlow } from "./build-voice-flow.mjs";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const localDir = join(projectRoot, ".local");

export function routeUnknownToGeneral(source) {
  const flow = structuredClone(source);
  if (!flow.Actions.some(action => action.Identifier === "Set general support queue")) {
    throw new Error("General support queue action is missing");
  }
  for (const name of ["Recognize English intent", "Recognize Spanish intent"]) {
    const action = flow.Actions.find(item => item.Identifier === name);
    if (!action || action.Type !== "ConnectParticipantWithLexBot") {
      throw new Error(`Expected Lex block ${name}`);
    }
    if (action.Transitions.NextAction !== "Choose routing path") {
      throw new Error(`${name} default branch changed; review it before editing`);
    }
    const noMatch = action.Transitions.Errors?.find(error => error.ErrorType === "NoMatchingCondition");
    if (!noMatch || noMatch.NextAction !== "Choose routing path") {
      throw new Error(`${name} no-match branch changed; review it before editing`);
    }
    action.Transitions.NextAction = "Set general support queue";
    noMatch.NextAction = "Set general support queue";
    // Silence and service failures still use the original keypad fallback.
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
  for (const name of ["profile", "region", "instance-id", "flow-id"]) {
    if (!opts[name]) throw new Error(`Missing --${name}=...`);
  }
  const output = execFileSync("aws", [
    "connect", "describe-contact-flow",
    "--instance-id", opts["instance-id"], "--contact-flow-id", opts["flow-id"],
    "--region", opts.region, "--profile", opts.profile, "--output", "json"
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const described = JSON.parse(output).ContactFlow;
  if (described?.Status !== "PUBLISHED") throw new Error("Expected a published source flow");
  const before = JSON.parse(described.Content);
  const candidate = routeUnknownToGeneral(before);
  mkdirSync(localDir, { recursive: true, mode: 0o700 });
  const backupPath = join(localDir, "flow-before-general-fallback.json");
  const candidatePath = join(localDir, "flow-general-fallback-candidate.json");
  writeFileSync(backupPath, JSON.stringify(before), { mode: 0o600 });
  writeFileSync(candidatePath, JSON.stringify(candidate), { mode: 0o600 });
  console.log("Validated English and Spanish no-match branches → general-support.");
  console.log("Silence and service errors still route to the keypad.");
  console.log(`Rollback copy: ${backupPath}`);
  console.log(`Candidate: ${candidatePath}`);
  console.log("No AWS resources were changed by this script.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
