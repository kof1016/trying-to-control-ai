import { isSha, isSha256, assert } from "./utils.mjs";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const MODES = new Set(["supervised", "delegated", "autonomous"]);
const KINDS = new Set(["PRODUCT", "SETUP", "MIGRATION", "FRAMEWORK"]);

function exactKeys(value, required, optional, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), "INVALID_CONTRACT", `${label} must be an object.`);
  for (const key of required) assert(Object.hasOwn(value, key), "INVALID_CONTRACT", `${label}.${key} is required.`);
  const allowed = new Set([...required, ...optional]);
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  assert(unexpected.length === 0, "INVALID_CONTRACT", `${label} has unexpected fields.`, { unexpected });
}

function isoDate(value, label) {
  assert(typeof value === "string" && !Number.isNaN(Date.parse(value)), "INVALID_CONTRACT", `${label} must be an ISO date-time.`);
}

export function validateChecks(checks) {
  assert(Array.isArray(checks) && checks.length > 0, "INVALID_CONTRACT", "project.checks must contain at least one check.");
  const ids = new Set();
  for (const [index, check] of checks.entries()) {
    exactKeys(check, ["id", "command"], ["timeoutSeconds"], `project.checks[${index}]`);
    assert(SLUG.test(check.id) && !ids.has(check.id), "INVALID_CONTRACT", `Check id must be unique kebab-case: ${check.id}`);
    ids.add(check.id);
    assert(Array.isArray(check.command) && check.command.length > 0 && check.command.every((part) => typeof part === "string" && part.length > 0), "INVALID_CONTRACT", `Check ${check.id} must use a non-empty argv array.`);
    if (check.timeoutSeconds !== undefined) {
      assert(Number.isInteger(check.timeoutSeconds) && check.timeoutSeconds >= 1 && check.timeoutSeconds <= 3600, "INVALID_CONTRACT", `Check ${check.id} timeout is invalid.`);
    }
  }
}

export function validateToolchain(value) {
  exactKeys(value, ["schemaVersion", "checks"], [], "toolchain");
  assert(value.schemaVersion === 1, "INVALID_CONTRACT", "toolchain.schemaVersion must be 1.");
  validateChecks(value.checks);
  return value;
}

export function validateProject(value) {
  exactKeys(value, ["schemaVersion", "frameworkVersion", "projectId", "setup", "defaultBranch", "checks", "frameworkLockSha256"], [], "project");
  assert(value.schemaVersion === 1, "INVALID_CONTRACT", "project.schemaVersion must be 1.");
  assert(/^\d+\.\d+\.\d+$/u.test(value.frameworkVersion), "INVALID_CONTRACT", "project.frameworkVersion must be semver.");
  assert(SLUG.test(value.projectId), "INVALID_CONTRACT", "project.projectId must be kebab-case.");
  exactKeys(value.setup, ["mode", "createdAt", "baselineCommit"], [], "project.setup");
  assert(["NEW_CODEBASE", "ADOPT_EXISTING"].includes(value.setup.mode), "INVALID_CONTRACT", "project.setup.mode is invalid.");
  isoDate(value.setup.createdAt, "project.setup.createdAt");
  assert(value.setup.baselineCommit === null || isSha(value.setup.baselineCommit), "INVALID_CONTRACT", "project.setup.baselineCommit is invalid.");
  assert(typeof value.defaultBranch === "string" && value.defaultBranch.length > 0, "INVALID_CONTRACT", "project.defaultBranch is required.");
  assert(isSha256(value.frameworkLockSha256), "INVALID_CONTRACT", "project.frameworkLockSha256 is invalid.");
  validateChecks(value.checks);
  return value;
}

export function validateWork(value) {
  exactKeys(value, ["schemaVersion", "workId", "kind", "branch", "base", "requestPath", "specPath", "confirmed", "freeze", "mode", "createdAt"], ["changes"], "work");
  assert(value.schemaVersion === 1 && SLUG.test(value.workId), "INVALID_CONTRACT", "work identity is invalid.");
  assert(KINDS.has(value.kind), "INVALID_CONTRACT", "work.kind is invalid.");
  assert(typeof value.branch === "string" && value.branch.length > 0, "INVALID_CONTRACT", "work.branch is required.");
  exactKeys(value.base, ["branch", "sha"], [], "work.base");
  assert(typeof value.base.branch === "string" && value.base.branch.length > 0, "INVALID_CONTRACT", "work.base.branch is required.");
  assert(value.base.sha === null || isSha(value.base.sha), "INVALID_CONTRACT", "work.base.sha is invalid.");
  const prefix = `.ai-sdlc/work/${value.workId}/`;
  assert(value.requestPath === `${prefix}request.md` && value.specPath === `${prefix}spec.md`, "INVALID_CONTRACT", "work authority paths do not match workId.");
  if (value.confirmed !== null) {
    exactKeys(value.confirmed, ["source", "at", "specSha256"], [], "work.confirmed");
    assert(typeof value.confirmed.source === "string" && value.confirmed.source.length > 0, "INVALID_CONTRACT", "confirmation source is required.");
    isoDate(value.confirmed.at, "work.confirmed.at");
    assert(isSha256(value.confirmed.specSha256), "INVALID_CONTRACT", "confirmation digest is invalid.");
  }
  if (value.freeze !== null) {
    exactKeys(value.freeze, ["commitSha", "specSha256", "at"], [], "work.freeze");
    assert(isSha(value.freeze.commitSha) && isSha256(value.freeze.specSha256), "INVALID_CONTRACT", "freeze identity is invalid.");
    isoDate(value.freeze.at, "work.freeze.at");
  }
  if (value.mode !== null) {
    exactKeys(value.mode, ["name", "at"], [], "work.mode");
    assert(MODES.has(value.mode.name), "INVALID_CONTRACT", "work.mode.name is invalid.");
    isoDate(value.mode.at, "work.mode.at");
  }
  if (value.changes !== undefined) {
    assert(Array.isArray(value.changes), "INVALID_CONTRACT", "work.changes must be an array.");
    for (const change of value.changes) {
      exactKeys(change, ["reason", "at", "previousFreezeCommit"], [], "work.changes[]");
      assert(typeof change.reason === "string" && change.reason.length > 0, "INVALID_CONTRACT", "Change reason is required.");
      isoDate(change.at, "work.changes[].at");
      assert(isSha(change.previousFreezeCommit), "INVALID_CONTRACT", "Previous freeze commit is invalid.");
    }
  }
  isoDate(value.createdAt, "work.createdAt");
  return value;
}

export function emptyEvidence(workId, subject, createdAt) {
  return {
    schemaVersion: 1,
    workId,
    subject,
    runs: [],
    reviews: { implementation: null, test: null },
    createdAt,
  };
}

export function validateEvidence(value) {
  exactKeys(value, ["schemaVersion", "workId", "subject", "runs", "reviews", "createdAt"], [], "evidence");
  assert(value.schemaVersion === 1 && SLUG.test(value.workId), "INVALID_CONTRACT", "evidence identity is invalid.");
  exactKeys(value.subject, ["headSha", "baseSha", "freezeCommitSha", "specSha256", "frameworkLockSha256"], [], "evidence.subject");
  assert(isSha(value.subject.headSha), "INVALID_CONTRACT", "evidence.subject.headSha is invalid.");
  assert(value.subject.baseSha === null || isSha(value.subject.baseSha), "INVALID_CONTRACT", "evidence.subject.baseSha is invalid.");
  assert(isSha(value.subject.freezeCommitSha) && isSha256(value.subject.specSha256) && isSha256(value.subject.frameworkLockSha256), "INVALID_CONTRACT", "evidence subject hashes are invalid.");
  assert(Array.isArray(value.runs), "INVALID_CONTRACT", "evidence.runs must be an array.");
  for (const [index, run] of value.runs.entries()) {
    exactKeys(run, ["kind", "checkId", "command", "headSha", "worktreeSha256", "exitCode", "result", "expectedFailure", "outputSha256", "at"], [], `evidence.runs[${index}]`);
    assert(["red", "green", "full"].includes(run.kind), "INVALID_CONTRACT", "Evidence run kind is invalid.");
    assert(SLUG.test(run.checkId) && Array.isArray(run.command) && run.command.length > 0 && run.command.every((part) => typeof part === "string" && part.length > 0), "INVALID_CONTRACT", "Evidence run command is invalid.");
    assert(isSha(run.headSha) && isSha256(run.worktreeSha256) && isSha256(run.outputSha256), "INVALID_CONTRACT", "Evidence run hashes are invalid.");
    assert(Number.isInteger(run.exitCode) && ["EXPECTED_FAIL", "PASS", "FAIL"].includes(run.result), "INVALID_CONTRACT", "Evidence run outcome is invalid.");
    assert(run.expectedFailure === null || (typeof run.expectedFailure === "string" && run.expectedFailure.length > 0), "INVALID_CONTRACT", "Evidence expected failure is invalid.");
    if (run.kind === "red") {
      assert(run.expectedFailure !== null && ["EXPECTED_FAIL", "FAIL"].includes(run.result) && (run.result !== "EXPECTED_FAIL" || run.exitCode !== 0), "INVALID_CONTRACT", "Red evidence does not prove or honestly reject its expected failure.");
    } else {
      assert(run.expectedFailure === null && run.result !== "EXPECTED_FAIL", "INVALID_CONTRACT", "Only Red evidence may contain an expected failure.");
    }
    assert(run.result !== "PASS" || run.exitCode === 0, "INVALID_CONTRACT", "A passing evidence run must exit zero.");
    isoDate(run.at, `evidence.runs[${index}].at`);
  }
  exactKeys(value.reviews, ["implementation", "test"], [], "evidence.reviews");
  for (const type of ["implementation", "test"]) {
    const review = value.reviews[type];
    if (review === null) continue;
    exactKeys(review, ["verdict", "summary", "findings", "at"], [], `evidence.reviews.${type}`);
    assert(["PASS", "BLOCKED"].includes(review.verdict) && typeof review.summary === "string" && review.summary.length > 0 && Array.isArray(review.findings), "INVALID_CONTRACT", `Evidence ${type} review is invalid.`);
    for (const finding of review.findings) {
      exactKeys(finding, ["severity", "location", "evidence", "impact", "recommendation"], [], `evidence.reviews.${type}.findings[]`);
      assert(["blocking", "warning", "note"].includes(finding.severity), "INVALID_CONTRACT", "Review finding severity is invalid.");
      assert(["location", "evidence", "impact", "recommendation"].every((key) => typeof finding[key] === "string" && finding[key].length > 0), "INVALID_CONTRACT", "Review finding text is invalid.");
    }
    assert(review.verdict !== "PASS" || review.findings.every((finding) => finding.severity !== "blocking"), "INVALID_CONTRACT", "PASS review contains a blocking finding.");
    assert(review.verdict !== "BLOCKED" || review.findings.some((finding) => finding.severity === "blocking"), "INVALID_CONTRACT", "BLOCKED review has no blocking finding.");
    isoDate(review.at, `evidence.reviews.${type}.at`);
  }
  isoDate(value.createdAt, "evidence.createdAt");
  return value;
}

export function fullRunPassed(evidence, checks = undefined) {
  const full = evidence.runs.filter((run) => run.kind === "full");
  if (full.length === 0 || !full.every((run) => run.result === "PASS" && run.headSha === evidence.subject.headSha)) return false;
  if (!checks) return true;
  if (full.length !== checks.length) return false;
  const byId = new Map(full.map((run) => [run.checkId, run]));
  return checks.every((check) => {
    const run = byId.get(check.id);
    return run && JSON.stringify(run.command) === JSON.stringify(check.command);
  });
}

export function reviewsPassed(evidence) {
  return evidence.reviews.implementation?.verdict === "PASS" && evidence.reviews.test?.verdict === "PASS";
}
