#!/usr/bin/env node

import {
  checkInstall,
  freeze,
  inspect,
  preflight,
  reopen,
  review,
  setMode,
  setup,
  start,
  verify,
} from "../lib/engine.mjs";
import { FrameworkError, optionalFlag, parseArgs, requireFlag, resolveRoot } from "../lib/utils.mjs";

function usage() {
  return {
    commands: ["check-install", "inspect", "setup", "start", "freeze", "mode", "verify", "review", "reopen", "preflight"],
    common: "--root <repository>",
  };
}

async function dispatch(command, flags) {
  const root = resolveRoot(optionalFlag(flags, "root"));
  switch (command) {
    case "check-install":
      return checkInstall(root);
    case "inspect":
      return inspect(root, optionalFlag(flags, "work-id"));
    case "setup":
      return setup(root, {
        mode: requireFlag(flags, "mode"),
        projectId: requireFlag(flags, "project-id"),
        toolchainPath: requireFlag(flags, "toolchain"),
        defaultBranch: optionalFlag(flags, "default-branch", "main"),
      });
    case "start":
      return start(root, {
        workId: requireFlag(flags, "work-id"),
        requestPath: requireFlag(flags, "request"),
        kind: requireFlag(flags, "kind"),
      });
    case "freeze":
      return freeze(root, {
        workId: requireFlag(flags, "work-id"),
        confirmationSource: requireFlag(flags, "confirmation-source"),
      });
    case "mode":
      return setMode(root, {
        workId: requireFlag(flags, "work-id"),
        mode: requireFlag(flags, "mode"),
      });
    case "verify":
      return verify(root, {
        workId: requireFlag(flags, "work-id"),
        kind: optionalFlag(flags, "kind", "full"),
        checkId: optionalFlag(flags, "check-id"),
        expectedFailure: optionalFlag(flags, "expected-failure"),
      });
    case "review":
      return review(root, {
        workId: requireFlag(flags, "work-id"),
        type: requireFlag(flags, "type"),
        verdict: requireFlag(flags, "verdict"),
        summary: requireFlag(flags, "summary"),
        findingsPath: optionalFlag(flags, "findings"),
      });
    case "reopen":
      return reopen(root, {
        workId: requireFlag(flags, "work-id"),
        reason: requireFlag(flags, "reason"),
      });
    case "preflight":
      return preflight(root, {
        workId: requireFlag(flags, "work-id"),
        action: requireFlag(flags, "action"),
        authorizationSource: optionalFlag(flags, "authorization-source"),
      });
    default:
      throw new FrameworkError("UNKNOWN_COMMAND", `Unknown command: ${command ?? "<missing>"}`, usage());
  }
}

const { positionals, flags } = parseArgs(process.argv.slice(2));

try {
  const result = await dispatch(positionals[0], flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  const payload = {
    ok: false,
    code: error instanceof FrameworkError ? error.code : "UNEXPECTED_ERROR",
    message: error.message,
    ...(error instanceof FrameworkError && error.details !== undefined ? { details: error.details } : {}),
  };
  process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exitCode = 1;
}
