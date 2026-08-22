import { spawnSync } from "node:child_process";

import { sha256 } from "../lib/utils.mjs";

export function runCheck(root, check) {
  const started = Date.now();
  const result = spawnSync(check.command[0], check.command.slice(1), {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    timeout: (check.timeoutSeconds ?? 900) * 1000,
    env: process.env,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return {
    command: check.command,
    exitCode: result.status ?? 1,
    output,
    outputSha256: sha256(output),
    durationMs: Date.now() - started,
    signal: result.signal ?? null,
  };
}
