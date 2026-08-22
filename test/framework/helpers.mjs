import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const thisDirectory = path.dirname(fileURLToPath(import.meta.url));

export const sourceRoot = path.resolve(thisDirectory, "../..");
export const cliPath = path.join(sourceRoot, ".ai-sdlc-framework/bin/ai-sdlc.mjs");

function execute(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      NO_COLOR: "1",
      TZ: "UTC",
      ...options.env,
    },
    timeout: options.timeout ?? 20_000,
  });
}

export function git(repository, args, options = {}) {
  const result = execute("git", args, { cwd: repository, ...options });
  if (options.allowFailure !== true && result.status !== 0) {
    assert.fail(
      `git ${args.join(" ")} failed (${result.status})\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }
  return result;
}

export function runCli(repository, args, options = {}) {
  const result = execute(process.execPath, [cliPath, ...args, "--root", repository], {
    cwd: repository,
    timeout: options.timeout ?? 30_000,
    env: options.env,
  });

  if (options.expectFailure === true) {
    assert.notEqual(
      result.status,
      0,
      `CLI unexpectedly succeeded: ${args.join(" ")}\nstdout:\n${result.stdout}`,
    );
    assert.notEqual(result.stderr.trim(), "", "A rejected command must explain why on stderr.");
    return result;
  }

  assert.equal(
    result.status,
    0,
    `CLI failed: ${args.join(" ")}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  assert.notEqual(result.stdout.trim(), "", "A successful command must emit JSON on stdout.");

  try {
    result.json = JSON.parse(result.stdout);
  } catch (error) {
    assert.fail(`Successful stdout is not JSON: ${error.message}\n${result.stdout}`);
  }

  return result;
}

export function inspect(repository, workId) {
  const args = ["inspect"];
  if (workId !== undefined) args.push("--work-id", workId);
  return runCli(repository, args);
}

export function assertNextAction(result, expected) {
  assert.equal(
    result.json.nextAction,
    expected,
    `Expected nextAction ${expected}; received ${JSON.stringify(result.json)}`,
  );
}

export async function installFramework(repository) {
  await access(cliPath);
  const installed = execute(process.execPath, [
    path.join(sourceRoot, "scripts/install-ai-sdlc.mjs"),
    "--source",
    sourceRoot,
    "--target",
    repository,
  ], { cwd: sourceRoot });
  assert.equal(installed.status, 0, `Framework install failed:\n${installed.stderr}`);
  for (const skillName of ["grilling", "tdd", "codebase-design"]) {
    await cp(
      path.join(sourceRoot, ".agents", "skills", skillName),
      path.join(repository, ".agents", "skills", skillName),
      { recursive: true },
    );
  }
  await cp(
    path.join(sourceRoot, "THIRD_PARTY_NOTICES.md"),
    path.join(repository, ".agents", "skills", "THIRD_PARTY_NOTICES.md"),
  );
}

export async function createRepository({ product = false, remote = false } = {}) {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "ai-sdlc-framework-test-"));
  const repository = path.join(fixtureRoot, "repository");
  await mkdir(repository, { recursive: true });

  git(repository, ["init", "-b", "main"]);
  git(repository, ["config", "user.name", "Framework Test"]);
  git(repository, ["config", "user.email", "framework-test@example.invalid"]);
  await installFramework(repository);

  if (product) {
    await mkdir(path.join(repository, "src"), { recursive: true });
    await writeFile(path.join(repository, "src/existing.txt"), "existing product\n", "utf8");
  }

  git(repository, ["add", "-A"]);
  git(repository, ["commit", "-m", "test: install framework baseline"]);

  let bareRemote = null;
  if (remote) {
    bareRemote = path.join(fixtureRoot, "remote.git");
    git(fixtureRoot, ["init", "--bare", bareRemote]);
    git(repository, ["remote", "add", "origin", bareRemote]);
    git(repository, ["push", "-u", "origin", "main"]);
  }

  return {
    fixtureRoot,
    repository,
    bareRemote,
    async cleanup() {
      await rm(fixtureRoot, { recursive: true, force: true });
    },
  };
}

export async function writeToolchain(fixtureRoot, { failing = false } = {}) {
  const toolchainPath = path.join(fixtureRoot, "toolchain.json");
  const checks = [
    {
      id: "lint",
      command: ["node", "-e", failing ? "process.exit(7)" : "process.exit(0)"],
    },
    {
      id: "unit",
      command: ["node", "-e", "process.stdout.write('1 test passed\\n')"],
    },
  ];
  await writeFile(toolchainPath, `${JSON.stringify({ schemaVersion: 1, checks }, null, 2)}\n`, "utf8");
  return toolchainPath;
}

export async function initialiseProject(fixture, mode = "NEW_CODEBASE") {
  const toolchainPath = await writeToolchain(fixture.fixtureRoot);
  runCli(fixture.repository, [
    "setup",
    "--mode",
    mode,
    "--project-id",
    mode === "NEW_CODEBASE" ? "new-project" : "adopted-project",
    "--toolchain",
    toolchainPath,
  ]);
  assertNextAction(inspect(fixture.repository), "define-requirement");
  commitAll(fixture.repository, "test: initialise framework foundation");
}

export function commitAll(repository, message) {
  git(repository, ["add", "-A"]);
  const staged = git(repository, ["diff", "--cached", "--quiet"], { allowFailure: true });
  if (staged.status === 0) return currentHead(repository);
  git(repository, ["commit", "-m", message]);
  return currentHead(repository);
}

export async function newDraft(fixture, workId = "work-one", kind = "PRODUCT") {
  const requestDirectory = path.join(fixture.repository, "request-inputs");
  const requestPath = path.join(requestDirectory, `${workId}.md`);
  await mkdir(requestDirectory, { recursive: true });
  await writeFile(requestPath, "# Request\n\nDeliver one observable capability.\n", "utf8");
  commitAll(fixture.repository, `test: add ${workId} request`);

  runCli(fixture.repository, [
    "start",
    "--work-id",
    workId,
    "--request",
    requestPath,
    "--kind",
    kind,
  ]);
  assertNextAction(inspect(fixture.repository, workId), "define-requirement");

  const specPath = path.join(fixture.repository, ".ai-sdlc/work", workId, "spec.md");
  commitAll(fixture.repository, `test: create ${workId} authority`);
  await writeFile(
    specPath,
    [
      "# Delivery Spec",
      "",
      "## Purpose",
      "",
      "Deliver the fixture capability.",
      "",
      "## Acceptance Criteria",
      "",
      "- The fixture command succeeds.",
      "",
      "## Boundaries and Errors",
      "",
      "The fixture must fail closed when its input is missing.",
      "",
      "## Non-Goals",
      "",
      "No remote delivery behavior is added.",
      "",
      "## Verification",
      "",
      "Run the configured lint and unit checks.",
      "",
      "## Open Decisions",
      "",
      "None.",
      "",
    ].join("\n"),
    "utf8",
  );

  return { workId, requestPath, specPath };
}

export async function freezeDraft(fixture, workId = "work-one") {
  const result = runCli(fixture.repository, [
    "freeze",
    "--work-id",
    workId,
    "--confirmation-source",
    "human:test",
  ]);
  assertNextAction(inspect(fixture.repository, workId), "choose-mode");
  return result;
}

export function setMode(repository, workId, mode = "autonomous") {
  const result = runCli(repository, [
    "mode",
    "--work-id",
    workId,
    "--mode",
    mode,
  ]);
  assertNextAction(inspect(repository, workId), "implement-change");
  return result;
}

export function verify(repository, workId) {
  const result = runCli(repository, ["verify", "--work-id", workId]);
  assertNextAction(inspect(repository, workId), "review-change");
  return result;
}

export function recordReview(repository, workId, type, verdict = "PASS") {
  return runCli(repository, [
    "review",
    "--work-id",
    workId,
    "--type",
    type,
    "--verdict",
    verdict,
    "--summary",
    `${type} contract ${verdict.toLowerCase()}`,
  ]);
}

export async function implementChange(fixture, workId, name = "capability.txt") {
  const productPath = path.join(fixture.repository, "src", name);
  await mkdir(path.dirname(productPath), { recursive: true });
  await writeFile(productPath, `implemented for ${workId}\n`, "utf8");
  commitAll(fixture.repository, `feat: implement ${workId}`);
  assertNextAction(inspect(fixture.repository, workId), "verify");
  return productPath;
}

export async function prepareReviewedWork(fixture, workId) {
  await initialiseProject(fixture);
  await newDraft(fixture, workId);
  await freezeDraft(fixture, workId);
  setMode(fixture.repository, workId);
  await implementChange(fixture, workId);
  verify(fixture.repository, workId);
  recordReview(fixture.repository, workId, "implementation");
  assertNextAction(inspect(fixture.repository, workId), "review-change");
  recordReview(fixture.repository, workId, "test");
  assertNextAction(inspect(fixture.repository, workId), "deliver");
}

export function currentHead(repository) {
  return git(repository, ["rev-parse", "HEAD"]).stdout.trim();
}

export function remoteHead(bareRemote, ref = "refs/heads/main") {
  return git(bareRemote, ["rev-parse", ref]).stdout.trim();
}

export async function readUtf8(file) {
  return readFile(file, "utf8");
}
