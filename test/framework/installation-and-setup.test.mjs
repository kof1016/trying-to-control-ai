import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { appendFile, chmod, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { changedPaths, commitExact } from "../../.ai-sdlc-framework/lib/git.mjs";
import {
  assertNextAction,
  commitAll,
  createRepository,
  git,
  initialiseProject,
  installFramework,
  inspect,
  runCli,
  sourceRoot,
  writeToolchain,
} from "./helpers.mjs";

function runInstaller(target) {
  return spawnSync(process.execPath, [
    path.join(sourceRoot, "scripts/install-ai-sdlc.mjs"),
    "--source",
    sourceRoot,
    "--target",
    target,
  ], { cwd: sourceRoot, encoding: "utf8" });
}

test("check-install accepts the exact LF installation and rejects CRLF drift", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());

  runCli(fixture.repository, ["check-install"]);

  const managedFile = path.join(
    fixture.repository,
    ".ai-sdlc-framework/contracts/project.schema.json",
  );
  const lf = (await readFile(managedFile, "utf8")).replace(/\r\n/g, "\n");
  assert.match(lf, /\n/, "Fixture must use a multiline managed text file");
  await writeFile(managedFile, lf.replace(/\n/g, "\r\n"), "utf8");

  const rejected = runCli(fixture.repository, ["check-install"], { expectFailure: true });
  assert.match(rejected.stderr, /(?:CRLF|EOL|integrity|install|checksum)/i);
});

test("check-install accepts a detached CI checkout through the canonical origin default branch", async (t) => {
  const fixture = await createRepository({ remote: true });
  t.after(() => fixture.cleanup());
  await initialiseProject(fixture, "NEW_CODEBASE");

  const detachedHead = git(fixture.repository, ["rev-parse", "HEAD"]).stdout.trim();
  git(fixture.repository, ["switch", "--detach", detachedHead]);
  git(fixture.repository, ["branch", "-D", "main"]);

  assert.notEqual(git(fixture.repository, ["show-ref", "--verify", "refs/heads/main"], { allowFailure: true }).status, 0);
  assert.equal(git(fixture.repository, ["show-ref", "--verify", "refs/remotes/origin/main"]).status, 0);
  runCli(fixture.repository, ["check-install"]);

  const requestPath = path.join(fixture.fixtureRoot, "detached-request.md");
  await writeFile(requestPath, "# Request\n\nDetached CI must stay read-only.\n", "utf8");
  const rejectedMutation = runCli(fixture.repository, [
    "start",
    "--work-id",
    "detached-mutation",
    "--request",
    requestPath,
    "--kind",
    "FRAMEWORK",
  ], { expectFailure: true });
  assert.match(rejectedMutation.stderr, /INVALID_DEFAULT_BRANCH|DETACHED_HEAD/);
});

test("check-install rejects a detached checkout without local or origin default branches", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  await initialiseProject(fixture, "NEW_CODEBASE");

  const detachedHead = git(fixture.repository, ["rev-parse", "HEAD"]).stdout.trim();
  git(fixture.repository, ["switch", "--detach", detachedHead]);
  git(fixture.repository, ["branch", "-D", "main"]);

  const rejected = runCli(fixture.repository, ["check-install"], { expectFailure: true });
  assert.match(rejected.stderr, /MISSING_DEFAULT_BRANCH/);
});

test("check-install rejects an installation lock or project fact for another Framework", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());

  const lockPath = path.join(fixture.repository, ".ai-sdlc/framework.lock.json");
  const lock = JSON.parse(await readFile(lockPath, "utf8"));
  lock.manifestSha256 = "0".repeat(64);
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  assert.match(runCli(fixture.repository, ["check-install"], { expectFailure: true }).stderr, /lock|manifest/i);

  await installFramework(fixture.repository);
  commitAll(fixture.repository, "test: repair installation lock");
  await initialiseProject(fixture, "NEW_CODEBASE");
  const projectPath = path.join(fixture.repository, ".ai-sdlc/project.json");
  const project = JSON.parse(await readFile(projectPath, "utf8"));
  project.frameworkLockSha256 = "0".repeat(64);
  await writeFile(projectPath, `${JSON.stringify(project, null, 2)}\n`, "utf8");
  assert.match(runCli(fixture.repository, ["check-install"], { expectFailure: true }).stderr, /project|framework/i);
});

test("check-install requires the exact lock-pinned third-party Skills and notice", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  const tddPath = path.join(fixture.repository, ".agents/skills/tdd/SKILL.md");
  const original = await readFile(tddPath, "utf8");
  await writeFile(tddPath, `${original}\nmodified\n`, "utf8");
  assert.match(runCli(fixture.repository, ["check-install"], { expectFailure: true }).stderr, /MATT_SKILLS_DRIFT/);
  await writeFile(tddPath, original, "utf8");
  await rm(path.join(fixture.repository, ".agents/skills/THIRD_PARTY_NOTICES.md"));
  assert.match(runCli(fixture.repository, ["check-install"], { expectFailure: true }).stderr, /MATT_SKILLS_DRIFT/);
});

test("setup derives setup-project then define-requirement for NEW and ADOPT", async (t) => {
  const fresh = await createRepository();
  const adopted = await createRepository({ product: true });
  t.after(() => Promise.all([fresh.cleanup(), adopted.cleanup()]));

  assertNextAction(inspect(fresh.repository), "setup-project");
  assertNextAction(inspect(adopted.repository), "setup-project");

  await initialiseProject(fresh, "NEW_CODEBASE");
  assertNextAction(inspect(fresh.repository), "define-requirement");

  const productPath = path.join(adopted.repository, "src/existing.txt");
  const originalProduct = await readFile(productPath, "utf8");
  await initialiseProject(adopted, "ADOPT_EXISTING");
  assertNextAction(inspect(adopted.repository), "define-requirement");
  assert.equal(await readFile(productPath, "utf8"), originalProduct);
});

test("setup is not recorded until every configured project check passes", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  const toolchain = await writeToolchain(fixture.fixtureRoot, { failing: true });

  const rejected = runCli(fixture.repository, [
    "setup",
    "--mode",
    "NEW_CODEBASE",
    "--project-id",
    "rejected-project",
    "--toolchain",
    toolchain,
  ], { expectFailure: true });
  assert.match(rejected.stderr, /SETUP_VERIFICATION_FAILED/);
  assertNextAction(inspect(fixture.repository), "setup-project");
});

test("setup rejects toolchain envelopes with missing, unknown, or unsupported schema fields", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  const toolchainPath = path.join(fixture.fixtureRoot, "invalid-toolchain.json");
  const check = { id: "unit", command: ["node", "-e", "process.exit(0)"] };

  for (const invalid of [
    [check],
    { schemaVersion: 999, checks: [check] },
    { schemaVersion: 1, checks: [check], state: "invented" },
  ]) {
    await writeFile(toolchainPath, `${JSON.stringify(invalid)}\n`, "utf8");
    const rejected = runCli(fixture.repository, [
      "setup",
      "--mode",
      "NEW_CODEBASE",
      "--project-id",
      "invalid-toolchain",
      "--toolchain",
      toolchainPath,
    ], { expectFailure: true });
    assert.match(rejected.stderr, /INVALID_CONTRACT/);
  }
  assertNextAction(inspect(fixture.repository), "setup-project");
});

test("interrupted setup is recoverable only when pending facts still match inputs and checks", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  const toolchainPath = await writeToolchain(fixture.fixtureRoot);
  const hook = path.join(fixture.repository, ".git/hooks/pre-commit");
  await writeFile(hook, "#!/bin/sh\nexit 1\n", "utf8");
  await chmod(hook, 0o755);

  assert.match(runCli(fixture.repository, [
    "setup", "--mode", "NEW_CODEBASE", "--project-id", "recoverable-project", "--toolchain", toolchainPath,
  ], { expectFailure: true }).stderr, /GIT_FAILED/);
  await rm(hook);

  const projectPath = path.join(fixture.repository, ".ai-sdlc/project.json");
  const expected = await readFile(projectPath, "utf8");
  const weakened = JSON.parse(expected);
  weakened.checks = [{ id: "bypass", command: ["node", "-e", "process.exit(0)"] }];
  await writeFile(projectPath, `${JSON.stringify(weakened, null, 2)}\n`, "utf8");
  assert.match(runCli(fixture.repository, [
    "setup", "--mode", "NEW_CODEBASE", "--project-id", "recoverable-project", "--toolchain", toolchainPath,
  ], { expectFailure: true }).stderr, /INVALID_SETUP_RECOVERY/);

  await writeFile(projectPath, expected, "utf8");
  const recovered = runCli(fixture.repository, [
    "setup", "--mode", "NEW_CODEBASE", "--project-id", "recoverable-project", "--toolchain", toolchainPath,
  ]);
  assert.equal(recovered.json.recovered, true);
  assert.equal(git(fixture.repository, ["status", "--porcelain"]).stdout, "");
});

test("installer refuses managed-file drift without overwriting local bytes", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  const managedPath = path.join(fixture.repository, ".ai-sdlc-framework/contracts/project.schema.json");
  const localBytes = "locally edited managed contract\n";
  await writeFile(managedPath, localBytes, "utf8");

  const result = runInstaller(fixture.repository);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /MANAGED_FILE_DRIFT/);
  assert.equal(await readFile(managedPath, "utf8"), localBytes);
});

test("installer preserves bytes outside AGENTS and attributes marker blocks", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  const agentsPath = path.join(fixture.repository, "AGENTS.md");
  const attributesPath = path.join(fixture.repository, ".gitattributes");
  await appendFile(agentsPath, "\nUser suffix with spaces  \n\n", "utf8");
  await appendFile(attributesPath, "\n# user suffix  \n\n", "utf8");
  const agentsBefore = await readFile(agentsPath, "utf8");
  const attributesBefore = await readFile(attributesPath, "utf8");

  const result = runInstaller(fixture.repository);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(agentsPath, "utf8"), agentsBefore);
  assert.equal(await readFile(attributesPath, "utf8"), attributesBefore);
});

test("installer rejects a managed target path through a symlink and leaves the outside directory untouched", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  const target = path.join(fixture.fixtureRoot, "symlink-target");
  const outside = path.join(fixture.fixtureRoot, "outside");
  await mkdir(target);
  await mkdir(outside);
  await writeFile(path.join(outside, "sentinel.txt"), "preserve\n", "utf8");
  await symlink(outside, path.join(target, ".agents"), "dir");

  const result = runInstaller(target);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SYMLINK_PATH/);
  assert.deepEqual((await readdir(outside)).sort(), ["sentinel.txt"]);
  assert.equal(await readFile(path.join(outside, "sentinel.txt"), "utf8"), "preserve\n");
  await rm(path.join(target, ".agents"), { force: true });
});

test("CLI rejects a project authority file replaced by a symlink", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  await initialiseProject(fixture, "NEW_CODEBASE");
  const projectPath = path.join(fixture.repository, ".ai-sdlc/project.json");
  const outside = path.join(fixture.fixtureRoot, "outside-project.json");
  await writeFile(outside, await readFile(projectPath));
  await rm(projectPath);
  await symlink(outside, projectPath);

  const rejected = runCli(fixture.repository, ["inspect"], { expectFailure: true });
  assert.match(rejected.stderr, /SYMLINK_PATH/);
});

test("exact commits reject a rename whose source is outside the allowed paths", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  const productPath = path.join(fixture.repository, "product.txt");
  const managedDirectory = path.join(fixture.repository, "allowed");
  await mkdir(managedDirectory, { recursive: true });
  await writeFile(productPath, "product bytes\n", "utf8");
  commitAll(fixture.repository, "test: add unrelated product file");
  git(fixture.repository, ["mv", "product.txt", "allowed/state.txt"]);

  assert.deepEqual(changedPaths(fixture.repository), ["allowed/state.txt", "product.txt"]);
  assert.throws(
    () => commitExact(fixture.repository, ["allowed/state.txt"], "test: forbidden partial rename"),
    /Unexpected staged paths/,
  );
  assert.equal(git(fixture.repository, ["log", "-1", "--format=%s"]).stdout.trim(), "test: add unrelated product file");
});

test("exact commits reject an unrelated staged type change", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  const victimPath = path.join(fixture.repository, "victim.txt");
  await writeFile(victimPath, "tracked file\n", "utf8");
  commitAll(fixture.repository, "test: add type-change victim");
  await rm(victimPath);
  await symlink("AGENTS.md", victimPath);
  git(fixture.repository, ["add", "--", "victim.txt"]);
  await writeFile(path.join(fixture.repository, "allowed.txt"), "allowed\n", "utf8");

  assert.throws(
    () => commitExact(fixture.repository, ["allowed.txt"], "test: forbidden staged type change"),
    /Unexpected staged paths/,
  );
  assert.equal(git(fixture.repository, ["log", "-1", "--format=%s"]).stdout.trim(), "test: add type-change victim");
});
