import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { appendFile, chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  assertNextAction,
  commitAll,
  createRepository,
  currentHead,
  freezeDraft,
  git,
  implementChange,
  initialiseProject,
  inspect,
  newDraft,
  recordReview,
  remoteHead,
  runCli,
  setMode,
  verify,
} from "./helpers.mjs";

test("start recovers exact request and Spec writes that preceded the work record", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  await initialiseProject(fixture);
  const workId = "start-recovery";
  const requestPath = path.join(fixture.repository, "request-inputs", `${workId}.md`);
  await mkdir(path.dirname(requestPath), { recursive: true });
  await writeFile(requestPath, "# Request\n\nRecover the interrupted start.\n", "utf8");
  commitAll(fixture.repository, "test: add interrupted start request");
  git(fixture.repository, ["switch", "-c", `feature/${workId}`]);

  const directory = path.join(fixture.repository, ".ai-sdlc", "work", workId);
  await mkdir(directory, { recursive: true });
  const requestText = await readFile(requestPath, "utf8");
  const template = await readFile(path.join(fixture.repository, ".ai-sdlc-framework", "templates", "SPEC.md"), "utf8");
  await writeFile(path.join(directory, "request.md"), requestText, "utf8");
  await writeFile(path.join(directory, "spec.md"), template.replaceAll("{{WORK_ID}}", workId), "utf8");

  const recovered = runCli(fixture.repository, ["start", "--work-id", workId, "--request", requestPath, "--kind", "PRODUCT"]);
  assert.equal(recovered.json.recovered, true);
  assert.equal(recovered.json.work.workId, workId);
  assert.equal(git(fixture.repository, ["status", "--porcelain"]).stdout, "");
  assertNextAction(inspect(fixture.repository, workId), "define-requirement");
});

test("start rejects product commits that already exist ahead of the default base", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  await initialiseProject(fixture);
  git(fixture.repository, ["switch", "-c", "feature/preexisting-change"]);
  await writeFile(path.join(fixture.repository, "preexisting.txt"), "not part of frozen work\n", "utf8");
  commitAll(fixture.repository, "feat: pre-existing unscoped change");
  const requestPath = path.join(fixture.fixtureRoot, "request.md");
  await writeFile(requestPath, "# Request\n\nStart after the change.\n", "utf8");

  const rejected = runCli(fixture.repository, ["start", "--work-id", "late-start", "--request", requestPath, "--kind", "PRODUCT"], { expectFailure: true });
  assert.match(rejected.stderr, /WORK_NOT_AT_BASE/);
});

test("freeze rejects implementation committed during requirement definition", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  await initialiseProject(fixture);
  const { workId } = await newDraft(fixture, "early-implementation");
  await writeFile(path.join(fixture.repository, "early.txt"), "implemented before freeze\n", "utf8");
  git(fixture.repository, ["add", "--", "early.txt"]);
  git(fixture.repository, ["commit", "-m", "feat: premature implementation"]);

  const rejected = runCli(fixture.repository, ["freeze", "--work-id", workId, "--confirmation-source", "human:test"], { expectFailure: true });
  assert.match(rejected.stderr, /PRE_FREEZE_IMPLEMENTATION/);
});

test("freeze requires inline confirmation, creates one local spec-only commit, and never pushes", async (t) => {
  const fixture = await createRepository({ remote: true });
  t.after(() => fixture.cleanup());
  await initialiseProject(fixture);
  const { workId, specPath } = await newDraft(fixture, "freeze-contract");

  const unconfirmed = runCli(fixture.repository, ["freeze", "--work-id", workId], {
    expectFailure: true,
  });
  assert.match(unconfirmed.stderr, /(?:confirmation-source|confirm|spec)/i);

  const remoteBefore = remoteHead(fixture.bareRemote);
  const remoteRefsBefore = git(fixture.repository, ["ls-remote", "--refs", "origin"]).stdout;
  const localBefore = currentHead(fixture.repository);
  const frozen = await freezeDraft(fixture, workId);

  const localAfter = currentHead(fixture.repository);
  assert.notEqual(localAfter, localBefore, "freeze must create a local commit");
  const changedPaths = git(fixture.repository, [
    "diff-tree",
    "--no-commit-id",
    "--name-only",
    "-r",
    frozen.json.freezeCommit,
  ]).stdout.trim().split(/\r?\n/).filter(Boolean);
  assert.deepEqual(changedPaths, [path.relative(fixture.repository, specPath).replaceAll("\\", "/")]);
  assert.notEqual(frozen.json.checkpointCommit, frozen.json.freezeCommit, "freeze facts must have a separate record-only checkpoint commit");
  assert.equal(remoteHead(fixture.bareRemote), remoteBefore, "freeze must not push");
  assert.equal(git(fixture.repository, ["ls-remote", "--refs", "origin"]).stdout, remoteRefsBefore, "freeze must not create or update any remote ref");
  assert.deepEqual(frozen.json.remoteActions, []);
  assertNextAction(inspect(fixture.repository, workId), "choose-mode");
});

test("freeze recovers an interrupted record-only checkpoint without repeating or pushing the Spec commit", async (t) => {
  const fixture = await createRepository({ remote: true });
  t.after(() => fixture.cleanup());
  await initialiseProject(fixture);
  const { workId } = await newDraft(fixture, "freeze-recovery");
  const hook = path.join(fixture.repository, ".git/hooks/pre-commit");
  const counter = path.join(fixture.repository, ".git/freeze-hook-count");
  await writeFile(hook, `#!/bin/sh\ncount=$(cat "${counter}" 2>/dev/null || echo 0)\ncount=$((count+1))\necho "$count" > "${counter}"\n[ "$count" -ne 2 ]\n`, "utf8");
  await chmod(hook, 0o755);
  const refsBefore = git(fixture.repository, ["ls-remote", "--refs", "origin"]).stdout;

  assert.match(runCli(fixture.repository, ["freeze", "--work-id", workId, "--confirmation-source", "human:recovery"], { expectFailure: true }).stderr, /GIT_FAILED/);
  const specCommit = currentHead(fixture.repository);
  await rm(hook);
  const workPath = path.join(fixture.repository, ".ai-sdlc/work", workId, "work.json");
  const expectedWork = await readFile(workPath, "utf8");
  const tampered = JSON.parse(expectedWork);
  tampered.changes.push({ reason: "unrelated recovery mutation", at: "2026-08-22T00:00:00.000Z", previousFreezeCommit: tampered.freeze.commitSha });
  await writeFile(workPath, `${JSON.stringify(tampered, null, 2)}\n`, "utf8");
  assert.match(runCli(fixture.repository, ["freeze", "--work-id", workId, "--confirmation-source", "human:recovery"], { expectFailure: true }).stderr, /INVALID_FREEZE_RECOVERY/);
  await writeFile(workPath, expectedWork, "utf8");
  const recovered = runCli(fixture.repository, ["freeze", "--work-id", workId, "--confirmation-source", "human:recovery"]);
  assert.equal(recovered.json.recovered, true);
  assert.equal(recovered.json.freezeCommit, specCommit);
  assert.equal(git(fixture.repository, ["ls-remote", "--refs", "origin"]).stdout, refsBefore);
  assertNextAction(inspect(fixture.repository, workId), "choose-mode");
});

test("freeze recovers when the Spec commit landed before any freeze facts were written", async (t) => {
  const fixture = await createRepository({ remote: true });
  t.after(() => fixture.cleanup());
  await initialiseProject(fixture);
  const { workId, specPath } = await newDraft(fixture, "freeze-before-record");
  const confirmationSource = "human:pre-record-recovery";
  const specText = (await readFile(specPath, "utf8")).replace(/\r\n?/gu, "\n");
  const digest = createHash("sha256").update(specText).digest("hex");
  const refsBefore = git(fixture.repository, ["ls-remote", "--refs", "origin"]).stdout;
  git(fixture.repository, ["add", "--", path.relative(fixture.repository, specPath)]);
  git(fixture.repository, [
    "commit",
    "-m",
    `docs(spec): freeze ${workId}\n\nAI-SDLC-Work: ${workId}\nAI-SDLC-Confirmation: ${confirmationSource}\nAI-SDLC-Spec-SHA256: ${digest}`,
  ]);
  const specCommit = currentHead(fixture.repository);

  const recovered = runCli(fixture.repository, ["freeze", "--work-id", workId, "--confirmation-source", confirmationSource]);
  assert.equal(recovered.json.recovered, true);
  assert.equal(recovered.json.freezeCommit, specCommit);
  assert.notEqual(recovered.json.checkpointCommit, specCommit);
  assert.equal(git(fixture.repository, ["ls-remote", "--refs", "origin"]).stdout, refsBefore);
  assertNextAction(inspect(fixture.repository, workId), "choose-mode");
});

test("mode recovery refuses unrelated work authority and then resumes the exact interrupted write", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  await initialiseProject(fixture);
  const { workId } = await newDraft(fixture, "mode-recovery");
  await freezeDraft(fixture, workId);
  const hook = path.join(fixture.repository, ".git/hooks/pre-commit");
  await writeFile(hook, "#!/bin/sh\nexit 1\n", "utf8");
  await chmod(hook, 0o755);
  assert.match(runCli(fixture.repository, ["mode", "--work-id", workId, "--mode", "delegated"], { expectFailure: true }).stderr, /GIT_FAILED/);
  await rm(hook);

  const workPath = path.join(fixture.repository, ".ai-sdlc/work", workId, "work.json");
  const expectedWork = await readFile(workPath, "utf8");
  const tampered = JSON.parse(expectedWork);
  tampered.changes.push({ reason: "unrelated mode mutation", at: "2026-08-22T00:00:00.000Z", previousFreezeCommit: tampered.freeze.commitSha });
  await writeFile(workPath, `${JSON.stringify(tampered, null, 2)}\n`, "utf8");
  assert.match(runCli(fixture.repository, ["mode", "--work-id", workId, "--mode", "delegated"], { expectFailure: true }).stderr, /INVALID_MODE_RECOVERY/);
  await writeFile(workPath, expectedWork, "utf8");
  const recovered = runCli(fixture.repository, ["mode", "--work-id", workId, "--mode", "delegated"]);
  assert.equal(recovered.json.recovered, true);
  assertNextAction(inspect(fixture.repository, workId), "implement-change");
});

test("supervised, delegated, and autonomous modes preserve identical gates", async (t) => {
  const observed = [];

  for (const selectedMode of ["supervised", "delegated", "autonomous"]) {
    const fixture = await createRepository();
    t.after(() => fixture.cleanup());
    await initialiseProject(fixture);
    const workId = `mode-${selectedMode}`;
    await newDraft(fixture, workId);
    const sequence = [inspect(fixture.repository, workId).json.nextAction];
    await freezeDraft(fixture, workId);
    sequence.push(inspect(fixture.repository, workId).json.nextAction);
    setMode(fixture.repository, workId, selectedMode);
    assertNextAction(inspect(fixture.repository, workId), "implement-change");
    sequence.push(inspect(fixture.repository, workId).json.nextAction);

    runCli(fixture.repository, ["preflight", "--work-id", workId, "--action", "publish"], {
      expectFailure: true,
    });
    await implementChange(fixture, workId);
    sequence.push(inspect(fixture.repository, workId).json.nextAction);
    verify(fixture.repository, workId);
    sequence.push(inspect(fixture.repository, workId).json.nextAction);
    recordReview(fixture.repository, workId, "implementation");
    assertNextAction(inspect(fixture.repository, workId), "review-change");
    recordReview(fixture.repository, workId, "test");
    assertNextAction(inspect(fixture.repository, workId), "deliver");
    sequence.push(inspect(fixture.repository, workId).json.nextAction);
    const publishArgs = ["preflight", "--work-id", workId, "--action", "publish"];
    if (selectedMode === "supervised") {
      assert.match(runCli(fixture.repository, publishArgs, { expectFailure: true }).stderr, /MISSING_DELIVERY_AUTHORIZATION/);
      publishArgs.push("--authorization-source", "human:test-publish");
    }
    const publish = runCli(fixture.repository, publishArgs);
    assert.equal(publish.json.deliveryPolicy.publishConfirmationRequired, selectedMode === "supervised");
    assert.equal(publish.json.deliveryPolicy.mergeConfirmationRequired, selectedMode !== "autonomous");
    observed.push(sequence);
  }

  assert.deepEqual(observed[0], observed[1]);
  assert.deepEqual(observed[1], observed[2]);
  assert.deepEqual(observed[0], [
    "define-requirement",
    "choose-mode",
    "implement-change",
    "verify",
    "review-change",
    "deliver",
  ]);
});

test("frozen Spec drift takes precedence and reopen returns to requirement work", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  await initialiseProject(fixture);
  const { workId, specPath } = await newDraft(fixture, "tampered-spec");
  await freezeDraft(fixture, workId);
  setMode(fixture.repository, workId, "autonomous");
  await implementChange(fixture, workId, "before-reopen.txt");

  await appendFile(specPath, "\nUnconfirmed behavior.\n", "utf8");
  assertNextAction(inspect(fixture.repository, workId), "spec-change-needed");

  const rejected = runCli(fixture.repository, ["verify", "--work-id", workId], {
    expectFailure: true,
  });
  assert.match(rejected.stderr, /(?:spec-change-needed|frozen|hash|tamper|reopen)/i);

  runCli(fixture.repository, [
    "reopen",
    "--work-id",
    workId,
    "--reason",
    "Acceptance criteria changed",
  ]);
  assertNextAction(inspect(fixture.repository, workId), "define-requirement");
  await freezeDraft(fixture, workId);
});

test("work directory and record identity cannot be cross-wired", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  await initialiseProject(fixture);
  const { workId } = await newDraft(fixture, "identity-one");
  const workPath = path.join(fixture.repository, ".ai-sdlc/work", workId, "work.json");
  const work = JSON.parse(await readFile(workPath, "utf8"));
  work.workId = "identity-two";
  work.requestPath = ".ai-sdlc/work/identity-two/request.md";
  work.specPath = ".ai-sdlc/work/identity-two/spec.md";
  await writeFile(workPath, `${JSON.stringify(work, null, 2)}\n`, "utf8");

  assert.match(runCli(fixture.repository, ["inspect", "--work-id", workId], { expectFailure: true }).stderr, /INVALID_WORK_IDENTITY/);
  assert.match(runCli(fixture.repository, ["inspect"], { expectFailure: true }).stderr, /INVALID_WORK_IDENTITY/);
});
