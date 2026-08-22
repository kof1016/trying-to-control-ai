import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { validateEvidence } from "../../.ai-sdlc-framework/lib/contracts.mjs";

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
  prepareReviewedWork,
  recordReview,
  runCli,
  setMode,
  verify,
} from "./helpers.mjs";

test("Red evidence cannot claim a zero-exit PASS", () => {
  const sha = "a".repeat(40);
  const digest = "b".repeat(64);
  const evidence = {
    schemaVersion: 1,
    workId: "red-contract",
    subject: { headSha: sha, baseSha: sha, freezeCommitSha: sha, specSha256: digest, frameworkLockSha256: digest },
    runs: [{ kind: "red", checkId: "unit", command: ["node", "--test"], headSha: sha, worktreeSha256: digest, exitCode: 0, result: "PASS", expectedFailure: "missing behavior", outputSha256: digest, at: "2026-08-22T00:00:00.000Z" }],
    reviews: { implementation: null, test: null },
    createdAt: "2026-08-22T00:00:00.000Z",
  };
  assert.throws(() => validateEvidence(evidence), /Red evidence/);
});

test("publish preflight requires fresh verification and two independent PASS reviews", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  const workId = "review-gate";

  await initialiseProject(fixture);
  await newDraft(fixture, workId);
  await freezeDraft(fixture, workId);
  setMode(fixture.repository, workId);
  await implementChange(fixture, workId);

  runCli(fixture.repository, ["preflight", "--work-id", workId, "--action", "publish"], {
    expectFailure: true,
  });
  assert.match(runCli(fixture.repository, ["verify", "--work-id", workId, "--kind", "full", "--check-id", "lint"], { expectFailure: true }).stderr, /FULL_REQUIRES_ALL_CHECKS/);
  verify(fixture.repository, workId);
  recordReview(fixture.repository, workId, "implementation");
  assertNextAction(inspect(fixture.repository, workId), "review-change");
  runCli(fixture.repository, ["preflight", "--work-id", workId, "--action", "publish"], {
    expectFailure: true,
  });

  recordReview(fixture.repository, workId, "test");
  assertNextAction(inspect(fixture.repository, workId), "deliver");
  runCli(fixture.repository, ["preflight", "--work-id", workId, "--action", "publish"]);
});

test("a new HEAD invalidates verification, reviews, and publish readiness", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  const workId = "stale-head";
  await prepareReviewedWork(fixture, workId);

  const before = currentHead(fixture.repository);
  await writeFile(path.join(fixture.repository, "src/late-change.txt"), "late change\n", "utf8");
  const after = commitAll(fixture.repository, "feat: change head after review");
  assert.notEqual(after, before);
  assertNextAction(inspect(fixture.repository, workId), "verify");

  const rejected = runCli(fixture.repository, [
    "preflight",
    "--work-id",
    workId,
    "--action",
    "publish",
  ], { expectFailure: true });
  assert.match(rejected.stderr, /(?:stale|head|evidence|verification|review)/i);
});

test("an advanced base must be integrated and invalidates the old exact-Head evidence", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  const workId = "advanced-base";
  await prepareReviewedWork(fixture, workId);
  const featureBranch = git(fixture.repository, ["branch", "--show-current"]).stdout.trim();

  git(fixture.repository, ["switch", "main"]);
  await writeFile(path.join(fixture.repository, "base-update.txt"), "new base\n", "utf8");
  commitAll(fixture.repository, "feat: advance base");
  git(fixture.repository, ["switch", featureBranch]);
  assertNextAction(inspect(fixture.repository, workId), "implement-change");
  assert.match(runCli(fixture.repository, ["preflight", "--work-id", workId, "--action", "publish"], { expectFailure: true }).stderr, /BASE_NOT_IN_HEAD/);

  git(fixture.repository, ["merge", "--no-edit", "main"]);
  assertNextAction(inspect(fixture.repository, workId), "verify");
});

test("merging an advanced base without a feature change does not masquerade as implementation", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  await initialiseProject(fixture);
  const workId = "base-only-merge";
  await newDraft(fixture, workId);
  await freezeDraft(fixture, workId);
  setMode(fixture.repository, workId);
  const featureBranch = git(fixture.repository, ["branch", "--show-current"]).stdout.trim();

  git(fixture.repository, ["switch", "main"]);
  await writeFile(path.join(fixture.repository, "base-only.txt"), "base capability\n", "utf8");
  commitAll(fixture.repository, "feat: advance base without feature implementation");
  git(fixture.repository, ["switch", featureBranch]);
  git(fixture.repository, ["merge", "--no-edit", "main"]);

  const result = inspect(fixture.repository, workId);
  assertNextAction(result, "implement-change");
  assert.deepEqual(result.json.changedPaths, []);
});

test("a BLOCKED review cannot satisfy either independent review gate", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  const workId = "blocked-review";

  await initialiseProject(fixture);
  await newDraft(fixture, workId);
  await freezeDraft(fixture, workId);
  setMode(fixture.repository, workId);
  await implementChange(fixture, workId);
  verify(fixture.repository, workId);

  const findingsPath = path.join(fixture.fixtureRoot, "blocking-findings.json");
  await writeFile(findingsPath, `${JSON.stringify([{
    severity: "blocking",
    location: "src/capability.txt",
    evidence: "The reviewed behavior is incomplete.",
    impact: "The acceptance criterion is not satisfied.",
    recommendation: "Implement and commit the missing behavior.",
  }], null, 2)}\n`, "utf8");
  runCli(fixture.repository, ["review", "--work-id", workId, "--type", "implementation", "--verdict", "BLOCKED", "--summary", "Implementation needs a committed fix", "--findings", findingsPath]);
  assert.match(runCli(fixture.repository, ["review", "--work-id", workId, "--type", "implementation", "--verdict", "PASS", "--summary", "Attempted same-Head override"], { expectFailure: true }).stderr, /REVIEW_REQUIRES_NEW_HEAD/);
  runCli(fixture.repository, ["verify", "--work-id", workId, "--kind", "green", "--check-id", "lint"]);
  assert.match(runCli(fixture.repository, ["verify", "--work-id", workId], { expectFailure: true }).stderr, /REVIEW_REQUIRES_NEW_HEAD/);
  recordReview(fixture.repository, workId, "test", "PASS");
  assertNextAction(inspect(fixture.repository, workId), "implement-change");
  runCli(fixture.repository, ["preflight", "--work-id", workId, "--action", "publish"], {
    expectFailure: true,
  });
});

test("dirty Red and Green are fingerprinted and carried to the committed delivery Head", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  const toolchainPath = path.join(fixture.fixtureRoot, "tdd-toolchain.json");
  const behavior = "const fs=require('node:fs');if(fs.existsSync('red-test-probe.txt')&&!fs.existsSync('src/capability.txt')){process.stderr.write('missing capability\\n');process.exit(1)}";
  await writeFile(toolchainPath, `${JSON.stringify({ schemaVersion: 1, checks: [{ id: "behavior", command: ["node", "-e", behavior] }] }, null, 2)}\n`, "utf8");
  runCli(fixture.repository, ["setup", "--mode", "NEW_CODEBASE", "--project-id", "tdd-fingerprint", "--toolchain", toolchainPath]);
  commitAll(fixture.repository, "test: initialise TDD project");
  const workId = "tdd-history";
  await newDraft(fixture, workId);
  await freezeDraft(fixture, workId);
  setMode(fixture.repository, workId);

  await writeFile(path.join(fixture.repository, "red-test-probe.txt"), "new failing test\n", "utf8");
  assert.match(runCli(fixture.repository, ["verify", "--work-id", workId, "--kind", "red", "--check-id", "behavior"], { expectFailure: true }).stderr, /MISSING_EXPECTED_FAILURE/);
  const red = runCli(fixture.repository, ["verify", "--work-id", workId, "--kind", "red", "--check-id", "behavior", "--expected-failure", "missing capability"]);
  assert.equal(red.json.runs[0].result, "EXPECTED_FAIL");
  await mkdir(path.join(fixture.repository, "src"), { recursive: true });
  await writeFile(path.join(fixture.repository, "src/capability.txt"), "implemented\n", "utf8");
  const green = runCli(fixture.repository, ["verify", "--work-id", workId, "--kind", "green", "--check-id", "behavior"]);
  assert.equal(green.json.runs[0].result, "PASS");
  assert.notEqual(red.json.runs[0].worktreeSha256, green.json.runs[0].worktreeSha256);

  commitAll(fixture.repository, "feat: implement fingerprinted TDD slice");
  const full = runCli(fixture.repository, ["verify", "--work-id", workId]);
  assert.deepEqual(full.json.runs.map((run) => run.kind), ["full"]);
  recordReview(fixture.repository, workId, "implementation");
  recordReview(fixture.repository, workId, "test");
  const publish = runCli(fixture.repository, ["preflight", "--work-id", workId, "--action", "publish"]);
  assert.match(publish.json.evidenceComment, /"kind": "red"/);
  assert.match(publish.json.evidenceComment, /"kind": "green"/);
});

test("TDD evidence from an abandoned divergent commit is not carried forward", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  const toolchainPath = path.join(fixture.fixtureRoot, "divergent-toolchain.json");
  const behavior = "const fs=require('node:fs');if(fs.existsSync('red-test-probe.txt')&&!fs.existsSync('src/capability.txt')){process.stderr.write('missing capability\\n');process.exit(1)}";
  await writeFile(toolchainPath, `${JSON.stringify({ schemaVersion: 1, checks: [{ id: "behavior", command: ["node", "-e", behavior] }] }, null, 2)}\n`, "utf8");
  runCli(fixture.repository, ["setup", "--mode", "NEW_CODEBASE", "--project-id", "divergent-tdd", "--toolchain", toolchainPath]);
  const workId = "divergent-history";
  await newDraft(fixture, workId);
  await freezeDraft(fixture, workId);
  setMode(fixture.repository, workId);
  const forkPoint = currentHead(fixture.repository);

  await writeFile(path.join(fixture.repository, "red-test-probe.txt"), "abandoned test\n", "utf8");
  commitAll(fixture.repository, "test: abandoned Red probe");
  const abandoned = runCli(fixture.repository, ["verify", "--work-id", workId, "--kind", "red", "--check-id", "behavior", "--expected-failure", "missing capability"]);
  git(fixture.repository, ["reset", "--hard", forkPoint]);

  await writeFile(path.join(fixture.repository, "red-test-probe.txt"), "replacement test\n", "utf8");
  await mkdir(path.join(fixture.repository, "src"), { recursive: true });
  await writeFile(path.join(fixture.repository, "src/capability.txt"), "replacement implementation\n", "utf8");
  commitAll(fixture.repository, "feat: implement replacement path");
  runCli(fixture.repository, ["verify", "--work-id", workId]);
  recordReview(fixture.repository, workId, "implementation");
  recordReview(fixture.repository, workId, "test");
  const publish = runCli(fixture.repository, ["preflight", "--work-id", workId, "--action", "publish"]);
  assert.doesNotMatch(publish.json.evidenceComment, new RegExp(abandoned.json.runs[0].outputSha256));
});
