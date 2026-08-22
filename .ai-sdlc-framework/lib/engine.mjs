import { access, mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

import { runCheck } from "../adapters/local.mjs";
import { assertMergeable, assertMerged, renderEvidenceComment, validateGitHubSnapshot } from "./github-adapter.mjs";
import { emptyEvidence, fullRunPassed, reviewsPassed, validateEvidence, validateProject, validateToolchain, validateWork } from "./contracts.mjs";
import {
  assertRepository,
  changedPaths,
  commitExact,
  commitPaths,
  currentBranch,
  git,
  headSha,
  isAncestor,
  lastCommitForPath,
  refSha,
  showFile,
  worktreeSha256,
} from "./git.mjs";
import {
  FrameworkError,
  assert,
  assertNoSymlinkPath,
  isSha,
  isSha256,
  normalizeLf,
  now,
  readJson,
  resolveInside,
  sha256,
  sha256File,
  slug,
  writeJson,
  writeText,
} from "./utils.mjs";

const FRAMEWORK_DIR = ".ai-sdlc-framework";
const RUNTIME_DIR = ".ai-sdlc";

function relativeWorkDir(workId) {
  return `${RUNTIME_DIR}/work/${workId}`;
}

function relativeWorkPath(workId) {
  return `${relativeWorkDir(workId)}/work.json`;
}

function evidencePath(root, workId, head) {
  return resolveInside(root, `${RUNTIME_DIR}/local/${workId}-${head}.json`);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function frameworkVersion(root) {
  await assertNoSymlinkPath(root, `${FRAMEWORK_DIR}/VERSION`);
  return (await readFile(resolveInside(root, `${FRAMEWORK_DIR}/VERSION`), "utf8")).trim();
}

async function manifest(root) {
  return readJson(resolveInside(root, `${FRAMEWORK_DIR}/manifest.json`));
}

async function checkMattSkills(root) {
  const lockRelative = `${FRAMEWORK_DIR}/locks/matt-skills.lock.json`;
  await assertNoSymlinkPath(root, lockRelative);
  const lock = await readJson(resolveInside(root, lockRelative));
  const skillNames = Object.keys(lock?.skills ?? {}).sort();
  assert(
    lock?.schemaVersion === 1
      && isSha(lock.commit)
      && isSha(lock.tagObject)
      && isSha256(lock.noticeSha256)
      && JSON.stringify(skillNames) === JSON.stringify(["codebase-design", "grilling", "tdd"]),
    "INVALID_MATT_SKILLS_LOCK",
    "Matt Skills lock is invalid.",
  );
  const mismatches = [];
  for (const skillName of skillNames) {
    const skill = lock.skills[skillName];
    assert(skill && isSha(skill.treeSha) && skill.files && typeof skill.files === "object", "INVALID_MATT_SKILLS_LOCK", `Matt Skill lock is invalid: ${skillName}`);
    for (const [relativeFile, expected] of Object.entries(skill.files)) {
      assert(isSha256(expected), "INVALID_MATT_SKILLS_LOCK", `Matt Skill digest is invalid: ${skillName}/${relativeFile}`);
      const relativePath = `.agents/skills/${skillName}/${relativeFile}`;
      await assertNoSymlinkPath(root, relativePath);
      const filePath = resolveInside(root, relativePath);
      if (!(await exists(filePath))) {
        mismatches.push({ path: relativePath, reason: "missing" });
        continue;
      }
      const actual = await sha256File(filePath);
      if (actual !== expected) mismatches.push({ path: relativePath, reason: "digest", expected, actual });
    }
  }
  const noticeRelative = ".agents/skills/THIRD_PARTY_NOTICES.md";
  await assertNoSymlinkPath(root, noticeRelative);
  const noticePath = resolveInside(root, noticeRelative);
  if (!(await exists(noticePath))) {
    mismatches.push({ path: noticeRelative, reason: "missing" });
  } else {
    const actual = await sha256File(noticePath);
    if (actual !== lock.noticeSha256) mismatches.push({ path: noticeRelative, reason: "digest", expected: lock.noticeSha256, actual });
  }
  assert(mismatches.length === 0, "MATT_SKILLS_DRIFT", "Lock-pinned Matt Skills are missing or modified.", { mismatches });
  return { commit: lock.commit, skills: skillNames };
}

export async function checkInstall(root) {
  const version = await frameworkVersion(root);
  assert(/^\d+\.\d+\.\d+$/u.test(version), "INVALID_INSTALL", "Framework VERSION is invalid.");
  const manifestPath = resolveInside(root, `${FRAMEWORK_DIR}/manifest.json`);
  await assertNoSymlinkPath(root, `${FRAMEWORK_DIR}/manifest.json`);
  const manifestBytes = await readFile(manifestPath);
  const value = await manifest(root);
  assert(value.schemaVersion === 1 && value.version === version && value.files && typeof value.files === "object", "INVALID_INSTALL", "Framework manifest is invalid.");
  const manifestDigest = sha256(manifestBytes);
  const lockPath = resolveInside(root, `${RUNTIME_DIR}/framework.lock.json`);
  await assertNoSymlinkPath(root, `${RUNTIME_DIR}/framework.lock.json`);
  assert(await exists(lockPath), "INVALID_INSTALL", "Framework installation lock is missing.");
  const lock = await readJson(lockPath);
  assert(
    lock?.schemaVersion === 1
      && lock.frameworkVersion === version
      && lock.manifestSha256 === manifestDigest
      && lock.managedFiles
      && typeof lock.managedFiles === "object",
    "INSTALL_LOCK_DRIFT",
    "Framework installation lock does not match the installed manifest.",
  );
  const manifestEntries = Object.entries(value.files).sort(([left], [right]) => left.localeCompare(right));
  const lockEntries = Object.entries(lock.managedFiles).sort(([left], [right]) => left.localeCompare(right));
  assert(JSON.stringify(lockEntries) === JSON.stringify(manifestEntries), "INSTALL_LOCK_DRIFT", "Framework installation lock does not match the managed file set.");
  const mismatches = [];
  for (const [relativePath, expected] of Object.entries(value.files)) {
    await assertNoSymlinkPath(root, relativePath);
    const filePath = resolveInside(root, relativePath);
    if (!(await exists(filePath))) {
      mismatches.push({ path: relativePath, reason: "missing" });
      continue;
    }
    const actual = await sha256File(filePath);
    if (actual !== expected) mismatches.push({ path: relativePath, reason: "digest", expected, actual });
  }
  assert(mismatches.length === 0, "INSTALL_DRIFT", "Installed Framework files do not match the manifest.", { mismatches });
  const mattSkills = await checkMattSkills(root);
  const projectPath = resolveInside(root, `${RUNTIME_DIR}/project.json`);
  if (await exists(projectPath)) {
    await assertNoSymlinkPath(root, `${RUNTIME_DIR}/project.json`);
    const project = await readProject(root);
    assert(
      project.frameworkVersion === version && project.frameworkLockSha256 === manifestDigest,
      "PROJECT_FRAMEWORK_DRIFT",
      "Project facts do not identify the currently installed Framework.",
    );
  }
  return { ok: true, version, files: Object.keys(value.files).length, manifestSha256: manifestDigest, mattSkills };
}

async function readProject(root) {
  await assertNoSymlinkPath(root, `${RUNTIME_DIR}/project.json`);
  const project = validateProject(await readJson(resolveInside(root, `${RUNTIME_DIR}/project.json`)));
  assert(git(root, ["check-ref-format", "--branch", project.defaultBranch], { allowFailure: true }).exitCode === 0, "INVALID_DEFAULT_BRANCH", "Project defaultBranch is not a safe Git branch name.");
  const defaultHead = refSha(root, `refs/heads/${project.defaultBranch}`)
    ?? refSha(root, `refs/remotes/origin/${project.defaultBranch}`);
  assert(defaultHead !== null, "MISSING_DEFAULT_BRANCH", "Project defaultBranch does not exist locally or as an origin remote-tracking branch.");
  assert(project.setup.baselineCommit === null || isAncestor(root, project.setup.baselineCommit, defaultHead), "INVALID_PROJECT_BASELINE", "Project setup baseline is not in the default branch history.");
  return project;
}

async function readWork(root, workId) {
  slug(workId, "work-id");
  await assertNoSymlinkPath(root, relativeWorkPath(workId));
  const work = validateWork(await readJson(resolveInside(root, relativeWorkPath(workId))));
  assert(work.workId === workId, "INVALID_WORK_IDENTITY", `Work record ${workId} claims identity ${work.workId}.`);
  await assertNoSymlinkPath(root, work.requestPath);
  await assertNoSymlinkPath(root, work.specPath);
  return work;
}

async function worksForBranch(root, branch) {
  const directory = resolveInside(root, `${RUNTIME_DIR}/work`);
  await assertNoSymlinkPath(root, `${RUNTIME_DIR}/work`);
  if (!(await exists(directory))) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const matches = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const filePath = path.join(directory, entry.name, "work.json");
    await assertNoSymlinkPath(root, `${RUNTIME_DIR}/work/${entry.name}/work.json`);
    if (!(await exists(filePath))) continue;
    const work = validateWork(await readJson(filePath));
    assert(work.workId === entry.name, "INVALID_WORK_IDENTITY", `Work directory ${entry.name} contains identity ${work.workId}.`);
    if (work.branch === branch) matches.push(work);
  }
  return matches;
}

async function chooseWork(root, workId = undefined) {
  if (workId) return readWork(root, workId);
  const branch = currentBranch(root);
  const matches = await worksForBranch(root, branch);
  assert(matches.length <= 1, "AMBIGUOUS_WORK", `More than one work record targets branch ${branch}.`);
  return matches[0] ?? null;
}

function specLooksComplete(text) {
  const chinese = text.includes("## 目標")
    && text.includes("## 可驗收條件")
    && /## 邊界與錯誤(?:處理)?/u.test(text)
    && text.includes("## 非目標")
    && text.includes("## 驗證方式");
  const english = text.includes("## Purpose")
    && text.includes("## Acceptance Criteria")
    && text.includes("## Boundaries and Errors")
    && text.includes("## Non-Goals")
    && text.includes("## Verification");
  return (chinese || english) && !/(?:\bTODO\b|<[^>\n]+>)/u.test(text);
}

async function currentSpecDigest(root, work) {
  const text = await readFile(resolveInside(root, work.specPath), "utf8");
  return sha256(normalizeLf(text));
}

function assertBranch(work, branch) {
  assert(work.branch === branch, "WRONG_BRANCH", `Work ${work.workId} belongs to ${work.branch}, not ${branch}.`);
}

function auditText(value, label) {
  assert(typeof value === "string" && value.length > 0 && value.length <= 256 && !/[\r\n\u0000-\u001f\u007f]/u.test(value), "INVALID_AUDIT_TEXT", `${label} must be a single printable line of at most 256 characters.`);
  return value;
}

function assertOnlyChanged(root, allowed, message) {
  const changed = changedPaths(root);
  const accepted = new Set(allowed);
  const unexpected = changed.filter((entry) => !accepted.has(entry));
  assert(changed.length > 0 && unexpected.length === 0, "DIRTY_WORKTREE", message, { changed, unexpected });
  return changed;
}

function canonicalGitHubRepository(root) {
  const remote = git(root, ["config", "--get", "remote.origin.url"], { allowFailure: true });
  assert(remote.exitCode === 0, "MISSING_GITHUB_REMOTE", "GitHub delivery requires a canonical origin remote.");
  const value = remote.stdout.trim();
  const match = /^(?:https?:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/u.exec(value);
  assert(match !== null, "INVALID_GITHUB_REMOTE", "The origin remote is not an unambiguous github.com repository.");
  return `${match[1]}/${match[2]}`;
}

function assertGitHubAdapterBinding(root, githubAdapter) {
  const expected = canonicalGitHubRepository(root);
  assert(githubAdapter?.repository === expected, "WRONG_GITHUB_REPOSITORY", "The injected GitHub Adapter does not match the canonical origin repository.");
  return expected;
}

function deliveryPolicy(mode) {
  return {
    mode,
    publishConfirmationRequired: mode === "supervised",
    mergeConfirmationRequired: mode !== "autonomous",
  };
}

function runSetupChecks(root, checks) {
  const before = worktreeSha256(root);
  const runs = checks.map((check) => {
    const result = runCheck(root, check);
    return {
      checkId: check.id,
      command: result.command,
      exitCode: result.exitCode,
      outputSha256: result.outputSha256,
      durationMs: result.durationMs,
    };
  });
  const failedChecks = runs.filter((run) => run.exitCode !== 0);
  assert(failedChecks.length === 0, "SETUP_VERIFICATION_FAILED", "Project checks must pass before setup is recorded.", { failedChecks });
  assert(worktreeSha256(root) === before, "CHECK_MUTATED_WORKTREE", "Project setup checks changed tracked or untracked source files.");
  return runs;
}

async function validateFreeze(root, work, { allowCurrentDrift = false, descendantSha = headSha(root) } = {}) {
  assert(work.freeze !== null && work.confirmed !== null, "SPEC_NOT_FROZEN", "The Spec has not been frozen.");
  assert(work.freeze.specSha256 === work.confirmed.specSha256, "FREEZE_MISMATCH", "Freeze and confirmation identify different Spec content.");
  assert(isAncestor(root, work.freeze.commitSha, descendantSha), "FREEZE_NOT_IN_HISTORY", "The frozen Spec commit is not an ancestor of the inspected Head.");
  const freezePaths = commitPaths(root, work.freeze.commitSha);
  assert(freezePaths.length === 1 && freezePaths[0] === work.specPath, "NOT_SPEC_ONLY", "The freeze commit must contain only the Spec file.", { freezePaths });
  const frozenText = showFile(root, work.freeze.commitSha, work.specPath);
  const frozenDigest = sha256(normalizeLf(frozenText));
  assert(frozenDigest === work.freeze.specSha256, "FREEZE_MISMATCH", "Frozen Git content does not match the recorded Spec digest.");
  if (!allowCurrentDrift) {
    const currentDigest = await currentSpecDigest(root, work);
    assert(currentDigest === frozenDigest, "SPEC_CHANGED", "The current Spec differs from its frozen Git content.");
  }
  return { commitSha: work.freeze.commitSha, specSha256: frozenDigest };
}

function currentBaseSha(root, work) {
  return refSha(root, `refs/heads/${work.base.branch}`) ?? work.base.sha;
}

async function loadEvidence(root, work, head = headSha(root)) {
  const filePath = evidencePath(root, work.workId, head);
  await assertNoSymlinkPath(root, `${RUNTIME_DIR}/local/${work.workId}-${head}.json`);
  if (!(await exists(filePath))) return null;
  const value = validateEvidence(await readJson(filePath));
  assert(value?.workId === work.workId && value?.subject?.headSha === head, "STALE_EVIDENCE", "Local evidence does not match the current work and HEAD.");
  return value;
}

async function priorTddRuns(root, work, subject) {
  const directory = resolveInside(root, `${RUNTIME_DIR}/local`);
  await assertNoSymlinkPath(root, `${RUNTIME_DIR}/local`);
  if (!(await exists(directory))) return [];
  const entries = await readdir(directory);
  const runs = [];
  const evidenceName = new RegExp(`^${work.workId}-[0-9a-f]{40}\\.json$`, "u");
  for (const entry of entries.filter((name) => evidenceName.test(name))) {
    await assertNoSymlinkPath(root, `${RUNTIME_DIR}/local/${entry}`);
    const candidate = validateEvidence(await readJson(path.join(directory, entry)));
    const sameContext = candidate?.workId === work.workId
      && candidate.subject?.baseSha === subject.baseSha
      && candidate.subject?.freezeCommitSha === subject.freezeCommitSha
      && candidate.subject?.specSha256 === subject.specSha256
      && candidate.subject?.frameworkLockSha256 === subject.frameworkLockSha256;
    if (!sameContext || candidate.subject.headSha === subject.headSha || !isAncestor(root, candidate.subject.headSha, subject.headSha) || !Array.isArray(candidate.runs)) continue;
    for (const run of candidate.runs) {
      if (!["red", "green"].includes(run?.kind) || run.headSha !== candidate.subject.headSha) continue;
      runs.push(run);
    }
  }
  const unique = new Map(runs.map((run) => [`${run.kind}:${run.checkId}:${run.headSha}:${run.worktreeSha256}:${run.outputSha256}`, run]));
  return [...unique.values()].sort((left, right) => left.at.localeCompare(right.at));
}

async function subjectFor(root, project, work) {
  assert(work.base.branch === project.defaultBranch, "INVALID_WORK_BASE", "Work base branch differs from the Project default branch.");
  const liveBase = refSha(root, `refs/heads/${project.defaultBranch}`);
  assert(isSha(work.base.sha) && liveBase !== null && isAncestor(root, work.base.sha, liveBase), "INVALID_WORK_BASE", "Work base SHA is not in the Project default branch history.");
  const freeze = await validateFreeze(root, work);
  const head = headSha(root);
  const base = currentBaseSha(root, work);
  assert(head !== null, "MISSING_HEAD", "A committed HEAD is required.");
  assert(base === null || isAncestor(root, base, head), "BASE_NOT_IN_HEAD", "The current base branch is not an ancestor of HEAD; integrate it before verification.");
  return {
    headSha: head,
    baseSha: base,
    freezeCommitSha: freeze.commitSha,
    specSha256: freeze.specSha256,
    frameworkLockSha256: project.frameworkLockSha256,
  };
}

function evidenceIsFresh(evidence, subject) {
  return evidence && Object.entries(subject).every(([key, value]) => evidence.subject?.[key] === value);
}

function implementationChangesFromBase(root, work) {
  const base = currentBaseSha(root, work);
  assert(isSha(base), "INVALID_WORK_BASE", "Work has no exact current base for implementation diff.");
  const output = git(root, ["diff", "--name-only", `${base}..HEAD`]).stdout.split("\n").filter(Boolean);
  const workPrefix = `${relativeWorkDir(work.workId)}/`;
  return output.filter((entry) => !entry.startsWith(workPrefix));
}

export async function inspect(root, workId = undefined) {
  await checkInstall(root);
  assertRepository(root);
  const projectPath = resolveInside(root, `${RUNTIME_DIR}/project.json`);
  if (!(await exists(projectPath))) return { nextAction: "setup-project", reason: "project record is missing" };
  const project = await readProject(root);
  const work = await chooseWork(root, workId);
  if (!work) return { nextAction: "define-requirement", projectId: project.projectId, reason: "no work record matches this branch" };
  assertBranch(work, currentBranch(root));
  const specPath = resolveInside(root, work.specPath);
  if (!(await exists(specPath))) {
    return { nextAction: work.freeze === null ? "define-requirement" : "spec-change-needed", workId: work.workId, reason: "Spec file is missing" };
  }
  if (work.freeze === null) {
    return { nextAction: "define-requirement", workId: work.workId, reason: "Spec is not frozen" };
  }
  try {
    await validateFreeze(root, work);
  } catch (error) {
    if (["SPEC_CHANGED", "FREEZE_MISMATCH", "FREEZE_NOT_IN_HISTORY", "NOT_SPEC_ONLY"].includes(error.code)) {
      return { nextAction: "spec-change-needed", workId: work.workId, reason: error.message };
    }
    throw error;
  }
  if (work.mode === null) return { nextAction: "choose-mode", workId: work.workId };
  const implementationPaths = implementationChangesFromBase(root, work);
  if (implementationPaths.length === 0 || changedPaths(root).length > 0) {
    return { nextAction: "implement-change", workId: work.workId, changedPaths: implementationPaths };
  }
  let subject;
  try {
    subject = await subjectFor(root, project, work);
  } catch (error) {
    if (error.code === "BASE_NOT_IN_HEAD") return { nextAction: "implement-change", workId: work.workId, reason: error.message };
    throw error;
  }
  const evidence = await loadEvidence(root, work, subject.headSha);
  if (!evidenceIsFresh(evidence, subject) || !fullRunPassed(evidence, project.checks)) return { nextAction: "verify", workId: work.workId };
  if (evidence.reviews.implementation?.verdict === "BLOCKED" || evidence.reviews.test?.verdict === "BLOCKED") {
    return { nextAction: "implement-change", workId: work.workId, reason: "review is blocked" };
  }
  if (!reviewsPassed(evidence)) {
    const requiredReviews = ["implementation", "test"].filter((type) => evidence.reviews[type]?.verdict !== "PASS");
    return { nextAction: "review-change", workId: work.workId, requiredReviews };
  }
  return { nextAction: "deliver", workId: work.workId, headSha: subject.headSha, deliveryPolicy: deliveryPolicy(work.mode.name) };
}

export async function setup(root, { mode, projectId, toolchainPath, defaultBranch = "main" }) {
  await checkInstall(root);
  assertRepository(root);
  assert(["NEW_CODEBASE", "ADOPT_EXISTING"].includes(mode), "INVALID_SETUP_MODE", "Setup mode must be NEW_CODEBASE or ADOPT_EXISTING.");
  slug(projectId, "project-id");
  const existingPath = resolveInside(root, `${RUNTIME_DIR}/project.json`);
  if (await exists(existingPath)) {
    const project = await readProject(root);
    const pending = changedPaths(root);
    const recoverable = [`${RUNTIME_DIR}/project.json`, `${RUNTIME_DIR}/.gitignore`];
    if (pending.some((entry) => recoverable.includes(entry))) {
      assertOnlyChanged(root, recoverable, "Interrupted setup recovery found unrelated changes.");
      const toolchain = await readJson(path.resolve(toolchainPath));
      validateToolchain(toolchain);
      assert(project.projectId === projectId && project.setup.mode === mode && project.defaultBranch === defaultBranch && project.setup.baselineCommit === headSha(root) && JSON.stringify(project.checks) === JSON.stringify(toolchain.checks), "INVALID_SETUP_RECOVERY", "Pending project facts do not match this setup request.");
      const setupVerification = runSetupChecks(root, toolchain.checks);
      const commitSha = commitExact(root, recoverable, "chore(ai-sdlc): establish project foundation");
      return { ok: true, project, setupVerification, commitSha, idempotent: false, recovered: true };
    }
    return { ok: true, project, idempotent: true };
  }
  assert(changedPaths(root).length === 0, "DIRTY_WORKTREE", "Project setup requires a clean committed baseline.");
  assert(git(root, ["check-ref-format", "--branch", defaultBranch], { allowFailure: true }).exitCode === 0, "INVALID_DEFAULT_BRANCH", "Default branch is not a safe Git branch name.");
  assert(refSha(root, `refs/heads/${defaultBranch}`) !== null && currentBranch(root) === defaultBranch, "INVALID_DEFAULT_BRANCH", "Setup must run on the existing default branch.");
  const toolchain = await readJson(path.resolve(toolchainPath));
  validateToolchain(toolchain);
  const checks = toolchain.checks;
  const setupVerification = runSetupChecks(root, checks);
  const baselineCommit = headSha(root);
  assert(mode !== "ADOPT_EXISTING" || baselineCommit !== null, "ADOPT_WITHOUT_BASELINE", "ADOPT_EXISTING requires an existing commit.");
  const version = await frameworkVersion(root);
  const manifestDigest = await sha256File(resolveInside(root, `${FRAMEWORK_DIR}/manifest.json`));
  const project = {
    schemaVersion: 1,
    frameworkVersion: version,
    projectId,
    setup: { mode, createdAt: now(), baselineCommit },
    defaultBranch,
    checks,
    frameworkLockSha256: manifestDigest,
  };
  validateProject(project);
  await assertNoSymlinkPath(root, `${RUNTIME_DIR}/project.json`);
  await assertNoSymlinkPath(root, `${RUNTIME_DIR}/.gitignore`);
  await assertNoSymlinkPath(root, `${RUNTIME_DIR}/work`);
  await writeJson(existingPath, project);
  await writeText(resolveInside(root, `${RUNTIME_DIR}/.gitignore`), "local/\n");
  await mkdir(resolveInside(root, `${RUNTIME_DIR}/work`), { recursive: true });
  const commitSha = commitExact(root, [`${RUNTIME_DIR}/project.json`, `${RUNTIME_DIR}/.gitignore`], "chore(ai-sdlc): establish project foundation");
  return { ok: true, project, setupVerification, commitSha, idempotent: false };
}

export async function start(root, { workId, requestPath, kind }) {
  await checkInstall(root);
  assertRepository(root);
  const project = await readProject(root);
  slug(workId, "work-id");
  assert(["PRODUCT", "SETUP", "MIGRATION", "FRAMEWORK"].includes(kind), "INVALID_WORK_KIND", "Work kind is invalid.");
  assert(refSha(root, `refs/heads/${project.defaultBranch}`) !== null, "INVALID_DEFAULT_BRANCH", "Configured default branch does not exist locally.");
  let branch = currentBranch(root);
  if (branch === project.defaultBranch) {
    branch = `feature/${workId}`;
    git(root, ["switch", "-c", branch]);
  }
  const directory = relativeWorkDir(workId);
  const recordPath = resolveInside(root, `${directory}/work.json`);
  await assertNoSymlinkPath(root, `${directory}/work.json`);
  const requestText = await readFile(path.resolve(requestPath), "utf8");
  const requestRelative = `${directory}/request.md`;
  const specRelative = `${directory}/spec.md`;
  const workRelative = relativeWorkPath(workId);
  await assertNoSymlinkPath(root, requestRelative);
  await assertNoSymlinkPath(root, specRelative);
  const template = await readFile(resolveInside(root, `${FRAMEWORK_DIR}/templates/SPEC.md`), "utf8");
  const normalizedRequest = normalizeLf(requestText).replace(/\n*$/u, "\n");
  const normalizedTemplate = normalizeLf(template.replaceAll("{{WORK_ID}}", workId)).replace(/\n*$/u, "\n");
  if (await exists(recordPath)) {
    const existingWork = await readWork(root, workId);
    const liveBase = refSha(root, `refs/heads/${project.defaultBranch}`) ?? project.setup.baselineCommit;
    const initialRecord = existingWork.branch === branch
      && existingWork.kind === kind
      && existingWork.base.branch === project.defaultBranch
      && isSha(existingWork.base.sha)
      && isAncestor(root, existingWork.base.sha, liveBase)
      && isAncestor(root, existingWork.base.sha, headSha(root))
      && existingWork.requestPath === requestRelative
      && existingWork.specPath === specRelative
      && existingWork.confirmed === null
      && existingWork.freeze === null
      && existingWork.mode === null
      && existingWork.changes.length === 0;
    assert(initialRecord, "ACTIVE_WORK_EXISTS", `Work ${workId} already exists and is not an interrupted start.`);
    const pending = changedPaths(root);
    const authority = [requestRelative, specRelative, relativeWorkPath(workId)];
    if (pending.length === 0) return { ok: true, work: existingWork, commitSha: lastCommitForPath(root, relativeWorkPath(workId)), nextAction: "define-requirement", idempotent: true };
    const requestMatches = await readFile(resolveInside(root, requestRelative), "utf8") === normalizedRequest;
    const specMatches = await readFile(resolveInside(root, specRelative), "utf8") === normalizedTemplate;
    assert(requestMatches && specMatches, "ACTIVE_WORK_EXISTS", `Work ${workId} already exists and is not an interrupted start.`);
    assertOnlyChanged(root, authority, "Interrupted start recovery found unrelated changes.");
    const commitSha = commitExact(root, authority, `docs(spec): start ${workId}`);
    return { ok: true, work: existingWork, commitSha, nextAction: "define-requirement", idempotent: false, recovered: true };
  }
  const existing = await worksForBranch(root, branch);
  assert(existing.length === 0, "ACTIVE_WORK_EXISTS", `Branch ${branch} already has a work record.`);
  const expectedBase = refSha(root, `refs/heads/${project.defaultBranch}`) ?? project.setup.baselineCommit;
  assert(headSha(root) === expectedBase, "WORK_NOT_AT_BASE", "New work must start at the exact current default-branch Head; move pre-existing feature changes to separate work first.");
  const pending = changedPaths(root);
  if (pending.length > 0) {
    assertOnlyChanged(root, [requestRelative, specRelative], "Interrupted start recovery found unrelated changes.");
    if (await exists(resolveInside(root, requestRelative))) {
      assert(await readFile(resolveInside(root, requestRelative), "utf8") === normalizedRequest, "INVALID_START_RECOVERY", "Pending request content does not match this start request.");
    }
    if (await exists(resolveInside(root, specRelative))) {
      assert(await readFile(resolveInside(root, specRelative), "utf8") === normalizedTemplate, "INVALID_START_RECOVERY", "Pending Spec content does not match the Framework template.");
    }
  }
  const work = {
    schemaVersion: 1,
    workId,
    kind,
    branch,
    base: { branch: project.defaultBranch, sha: expectedBase },
    requestPath: requestRelative,
    specPath: specRelative,
    confirmed: null,
    freeze: null,
    mode: null,
    changes: [],
    createdAt: now(),
  };
  validateWork(work);
  await writeText(resolveInside(root, requestRelative), normalizedRequest);
  await writeText(resolveInside(root, specRelative), normalizedTemplate);
  await writeJson(recordPath, work);
  const commitSha = commitExact(root, [requestRelative, specRelative, workRelative], `docs(spec): start ${workId}`);
  return { ok: true, work, commitSha, nextAction: "define-requirement", ...(pending.length > 0 ? { recovered: true } : {}) };
}

export async function freeze(root, { workId, confirmationSource }) {
  await checkInstall(root);
  assertRepository(root);
  const work = await readWork(root, workId);
  assertBranch(work, currentBranch(root));
  auditText(confirmationSource, "confirmation-source");
  if (work.freeze !== null) {
    assert(work.confirmed?.source === confirmationSource, "ALREADY_FROZEN", "The Spec is already frozen with another confirmation source.");
    assert(work.mode === null, "ALREADY_FROZEN", "Freeze cannot be replayed after mode selection.");
    await validateFreeze(root, work);
    const previous = validateWork(JSON.parse(showFile(root, "HEAD", relativeWorkPath(workId))));
    const expected = { ...previous, confirmed: work.confirmed, freeze: work.freeze };
    assert(JSON.stringify(work) === JSON.stringify(expected), "INVALID_FREEZE_RECOVERY", "Pending work facts contain changes beyond the interrupted Freeze record.");
    const pending = changedPaths(root);
    let checkpointCommit = lastCommitForPath(root, relativeWorkPath(workId));
    if (pending.length > 0) {
      assertOnlyChanged(root, [relativeWorkPath(workId)], "Interrupted freeze recovery found unrelated changes.");
      checkpointCommit = commitExact(root, [relativeWorkPath(workId)], `chore(ai-sdlc): record ${workId} freeze`);
    }
    return { ok: true, workId, freezeCommit: work.freeze.commitSha, checkpointCommit, nextAction: "choose-mode", remoteActions: [], idempotent: pending.length === 0, recovered: pending.length > 0 };
  }
  const specText = await readFile(resolveInside(root, work.specPath), "utf8");
  assert(specLooksComplete(specText), "INCOMPLETE_SPEC", "The Spec still contains placeholders or required sections are missing.");
  const authorityAnchor = lastCommitForPath(root, relativeWorkPath(workId));
  const expectedAnchorSubject = work.changes.length === 0 ? `docs(spec): start ${workId}` : `docs(spec): reopen ${workId}`;
  const anchorSubject = isSha(authorityAnchor) ? git(root, ["show", "-s", "--format=%s", authorityAnchor]).stdout.trim() : "";
  const anchorWork = isSha(authorityAnchor) ? validateWork(JSON.parse(showFile(root, authorityAnchor, relativeWorkPath(workId)))) : null;
  assert(
    isSha(authorityAnchor)
      && isAncestor(root, authorityAnchor, headSha(root))
      && anchorSubject === expectedAnchorSubject
      && JSON.stringify(anchorWork) === JSON.stringify(work),
    "INVALID_REQUIREMENT_ANCHOR",
    "The current unfrozen work facts do not match their exact start or reopen checkpoint.",
  );
  const featureOnlyCommits = git(root, ["rev-list", "HEAD", `^${authorityAnchor}`]).stdout.split("\n").filter(Boolean);
  const workPrefix = `${relativeWorkDir(workId)}/`;
  const preFreezeImplementation = [...new Set(featureOnlyCommits.flatMap((commit) => commitPaths(root, commit)).filter((entry) => !entry.startsWith(workPrefix)))].sort();
  assert(preFreezeImplementation.length === 0, "PRE_FREEZE_IMPLEMENTATION", "Product or project changes must not be committed before the Spec freeze.", { preFreezeImplementation });
  const changed = changedPaths(root);
  const digest = sha256(normalizeLf(specText));
  if (changed.length === 0) {
    const freezeCommit = headSha(root);
    const expectedMessage = `docs(spec): freeze ${workId}\n\nAI-SDLC-Work: ${workId}\nAI-SDLC-Confirmation: ${confirmationSource}\nAI-SDLC-Spec-SHA256: ${digest}`;
    const actualMessage = normalizeLf(git(root, ["show", "-s", "--format=%B", freezeCommit]).stdout).replace(/\n+$/u, "");
    const freezePaths = commitPaths(root, freezeCommit);
    const committedWork = validateWork(JSON.parse(showFile(root, freezeCommit, relativeWorkPath(workId))));
    const committedSpecDigest = sha256(normalizeLf(showFile(root, freezeCommit, work.specPath)));
    const interruptedFreeze = freezePaths.length === 1
      && freezePaths[0] === work.specPath
      && actualMessage === expectedMessage
      && committedSpecDigest === digest
      && committedWork.confirmed === null
      && committedWork.freeze === null
      && committedWork.mode === null
      && JSON.stringify(committedWork) === JSON.stringify(work);
    assert(interruptedFreeze, "NOT_SPEC_ONLY", "A clean retry is not the exact interrupted Spec freeze commit.", { freezePaths });
    const committedAt = new Date(git(root, ["show", "-s", "--format=%cI", freezeCommit]).stdout.trim()).toISOString();
    work.confirmed = { source: confirmationSource, at: committedAt, specSha256: digest };
    work.freeze = { commitSha: freezeCommit, specSha256: digest, at: committedAt };
    await writeJson(resolveInside(root, relativeWorkPath(workId)), work);
    const checkpointCommit = commitExact(root, [relativeWorkPath(workId)], `chore(ai-sdlc): record ${workId} freeze`);
    return { ok: true, workId, freezeCommit, checkpointCommit, nextAction: "choose-mode", remoteActions: [], recovered: true };
  }
  assert(changed.length === 1 && changed[0] === work.specPath, "NOT_SPEC_ONLY", "Only the Spec file may be changed when freezing.", { changed });
  work.confirmed = { source: confirmationSource, at: now(), specSha256: digest };
  const freezeCommit = commitExact(
    root,
    [work.specPath],
    `docs(spec): freeze ${workId}\n\nAI-SDLC-Work: ${workId}\nAI-SDLC-Confirmation: ${confirmationSource}\nAI-SDLC-Spec-SHA256: ${digest}`,
  );
  const freezePaths = commitPaths(root, freezeCommit);
  assert(freezePaths.length === 1 && freezePaths[0] === work.specPath, "NOT_SPEC_ONLY", "Freeze commit contains unrelated paths.", { freezePaths });
  work.freeze = { commitSha: freezeCommit, specSha256: digest, at: now() };
  await writeJson(resolveInside(root, relativeWorkPath(workId)), work);
  const checkpointCommit = commitExact(root, [relativeWorkPath(workId)], `chore(ai-sdlc): record ${workId} freeze`);
  return { ok: true, workId, freezeCommit, checkpointCommit, nextAction: "choose-mode", remoteActions: [] };
}

export async function setMode(root, { workId, mode }) {
  await checkInstall(root);
  assertRepository(root);
  const work = await readWork(root, workId);
  assertBranch(work, currentBranch(root));
  await validateFreeze(root, work);
  assert(["supervised", "delegated", "autonomous"].includes(mode), "INVALID_MODE", "Mode must be supervised, delegated, or autonomous.");
  if (work.mode !== null) {
    assert(work.mode.name === mode, "MODE_ALREADY_SELECTED", `Work ${workId} already uses mode ${work.mode.name}.`);
    const previous = validateWork(JSON.parse(showFile(root, "HEAD", relativeWorkPath(workId))));
    const expected = { ...previous, mode: work.mode };
    assert(JSON.stringify(work) === JSON.stringify(expected), "INVALID_MODE_RECOVERY", "Pending work facts contain changes beyond the interrupted mode record.");
    const pending = changedPaths(root);
    let commitSha = lastCommitForPath(root, relativeWorkPath(workId));
    if (pending.length > 0) {
      assertOnlyChanged(root, [relativeWorkPath(workId)], "Interrupted mode recovery found unrelated changes.");
      commitSha = commitExact(root, [relativeWorkPath(workId)], `chore(ai-sdlc): set ${workId} mode to ${mode}`);
    }
    return { ok: true, workId, mode, commitSha, nextAction: "implement-change", idempotent: pending.length === 0, recovered: pending.length > 0 };
  }
  const dirty = changedPaths(root);
  assert(dirty.length === 0, "DIRTY_WORKTREE", "Changing mode requires the recorded freeze checkpoint and a clean worktree.", { dirty });
  work.mode = { name: mode, at: now() };
  await writeJson(resolveInside(root, relativeWorkPath(workId)), work);
  const commitSha = commitExact(root, [relativeWorkPath(workId)], `chore(ai-sdlc): set ${workId} mode to ${mode}`);
  return { ok: true, workId, mode, commitSha, nextAction: "implement-change" };
}

export async function verify(root, { workId, kind = "full", checkId = undefined, expectedFailure = undefined }) {
  await checkInstall(root);
  assertRepository(root);
  const project = await readProject(root);
  const work = await readWork(root, workId);
  assertBranch(work, currentBranch(root));
  await validateFreeze(root, work);
  assert(work.mode !== null, "MODE_NOT_SELECTED", "Select a mode after freezing the Spec.");
  assert(["red", "green", "full"].includes(kind), "INVALID_VERIFY_KIND", "Verification kind must be red, green, or full.");
  const verificationChanges = changedPaths(root);
  if (kind === "full") {
    assert(verificationChanges.length === 0, "DIRTY_WORKTREE", "Full verification requires a clean committed worktree.");
  } else {
    const authorityChanges = verificationChanges.filter((entry) => entry === "AGENTS.md" || entry.startsWith(".ai-sdlc/") || entry.startsWith(".ai-sdlc-framework/") || entry.startsWith(".agents/skills/"));
    assert(authorityChanges.length === 0, "AUTHORITY_CHANGED_DURING_TDD", "Red and Green may include product or test changes, not Framework authority changes.", { authorityChanges });
  }
  assert(kind !== "full" || checkId === undefined, "FULL_REQUIRES_ALL_CHECKS", "Full verification must run every configured project check.");
  assert(kind !== "red" || (typeof expectedFailure === "string" && expectedFailure.length > 0), "MISSING_EXPECTED_FAILURE", "Red verification requires an expected failure signature.");
  const subject = await subjectFor(root, project, work);
  const selected = checkId ? project.checks.filter((check) => check.id === checkId) : project.checks;
  assert(selected.length > 0, "UNKNOWN_CHECK", "No verification check matched the request.");
  const loaded = await loadEvidence(root, work, subject.headSha);
  const existing = loaded ?? emptyEvidence(workId, subject, now());
  if (!loaded) existing.runs = await priorTddRuns(root, work, subject);
  if (!evidenceIsFresh(existing, subject)) throw new FrameworkError("STALE_EVIDENCE", "Existing evidence is stale.");
  if (kind === "full") assert(!Object.values(existing.reviews).some((review) => review?.verdict === "BLOCKED"), "REVIEW_REQUIRES_NEW_HEAD", "A blocked review requires an implementation commit before full verification can run again.");
  const runs = [];
  let failed = false;
  for (const check of selected) {
    const checkedWorktreeSha256 = worktreeSha256(root);
    const result = runCheck(root, check);
    assert(worktreeSha256(root) === checkedWorktreeSha256, "CHECK_MUTATED_WORKTREE", `Verification check ${check.id} changed tracked or untracked source files.`);
    let outcome;
    if (kind === "red") {
      const signatureMatches = !expectedFailure || result.output.includes(expectedFailure);
      outcome = result.exitCode !== 0 && signatureMatches ? "EXPECTED_FAIL" : "FAIL";
    } else {
      outcome = result.exitCode === 0 ? "PASS" : "FAIL";
    }
    if (outcome === "FAIL") failed = true;
    runs.push({
      kind,
      checkId: check.id,
      command: result.command,
      headSha: subject.headSha,
      worktreeSha256: checkedWorktreeSha256,
      exitCode: result.exitCode,
      result: outcome,
      expectedFailure: expectedFailure ?? null,
      outputSha256: result.outputSha256,
      at: now(),
    });
  }
  if (kind === "full") {
    existing.runs = [...existing.runs.filter((run) => run.kind !== "full"), ...runs];
  } else {
    existing.runs.push(...runs);
  }
  if (kind === "full") existing.reviews = { implementation: null, test: null };
  existing.createdAt = now();
  validateEvidence(existing);
  await writeJson(evidencePath(root, workId, subject.headSha), existing);
  assert(!failed, "VERIFICATION_FAILED", "One or more verification checks failed.", { runs });
  return { ok: true, workId, subject, runs, nextAction: kind === "full" ? "review-change" : "implement-change" };
}

export async function review(root, { workId, type, verdict, summary, findingsPath = undefined }) {
  await checkInstall(root);
  assertRepository(root);
  assert(["implementation", "test"].includes(type), "INVALID_REVIEW_TYPE", "Review type must be implementation or test.");
  assert(["PASS", "BLOCKED"].includes(verdict), "INVALID_REVIEW_VERDICT", "Review verdict must be PASS or BLOCKED.");
  assert(typeof summary === "string" && summary.length > 0, "MISSING_REVIEW_SUMMARY", "Review summary is required.");
  const project = await readProject(root);
  const work = await readWork(root, workId);
  assertBranch(work, currentBranch(root));
  assert(changedPaths(root).length === 0, "DIRTY_WORKTREE", "Review requires a clean committed worktree.");
  const subject = await subjectFor(root, project, work);
  const evidence = await loadEvidence(root, work, subject.headSha);
  assert(evidenceIsFresh(evidence, subject) && fullRunPassed(evidence, project.checks), "MISSING_VERIFICATION", "Fresh full verification is required before Review.");
  let findings = [];
  if (findingsPath) findings = await readJson(path.resolve(findingsPath));
  assert(Array.isArray(findings), "INVALID_FINDINGS", "Review findings must be a JSON array.");
  const blocking = findings.filter((finding) => finding.severity === "blocking");
  assert(verdict !== "PASS" || blocking.length === 0, "REVIEW_CONTRADICTION", "A PASS review cannot contain blocking findings.");
  assert(verdict !== "BLOCKED" || blocking.length > 0, "REVIEW_CONTRADICTION", "A BLOCKED review must contain at least one actionable blocking finding.");
  assert(!(evidence.reviews[type]?.verdict === "BLOCKED" && verdict === "PASS"), "REVIEW_REQUIRES_NEW_HEAD", "A blocked review cannot become PASS on the same Head; implement and commit the fix first.");
  evidence.reviews[type] = { verdict, summary, findings, at: now() };
  validateEvidence(evidence);
  await writeJson(evidencePath(root, workId, subject.headSha), evidence);
  return { ok: true, workId, type, verdict, nextAction: verdict === "BLOCKED" ? "implement-change" : reviewsPassed(evidence) ? "deliver" : "review-change" };
}

export async function reopen(root, { workId, reason }) {
  await checkInstall(root);
  assertRepository(root);
  auditText(reason, "reason");
  const work = await readWork(root, workId);
  assertBranch(work, currentBranch(root));
  await validateFreeze(root, work, { allowCurrentDrift: true });
  const dirty = changedPaths(root);
  assert(dirty.length === 0 || (dirty.length === 1 && dirty[0] === work.specPath), "DIRTY_WORKTREE", "Only the changed Spec may remain uncommitted during change control.", { dirty });
  work.changes ??= [];
  work.changes.push({ reason, at: now(), previousFreezeCommit: work.freeze.commitSha });
  work.confirmed = null;
  work.freeze = null;
  work.mode = null;
  await writeJson(resolveInside(root, relativeWorkPath(workId)), work);
  const commitSha = commitExact(root, [relativeWorkPath(workId)], `docs(spec): reopen ${workId}`);
  const localDirectory = resolveInside(root, `${RUNTIME_DIR}/local`);
  await assertNoSymlinkPath(root, `${RUNTIME_DIR}/local`);
  if (await exists(localDirectory)) {
    const entries = await readdir(localDirectory);
    const evidenceName = new RegExp(`^${workId}-[0-9a-f]{40}\\.json$`, "u");
    await Promise.all(entries.filter((entry) => evidenceName.test(entry)).map((entry) => rm(path.join(localDirectory, entry), { force: true })));
  }
  return { ok: true, workId, commitSha, nextAction: "define-requirement" };
}

async function localDeliveryPreflight(root, { workId, action, authorizationSource = undefined, requirePublishAuthorization }) {
  await checkInstall(root);
  assertRepository(root);
  assert(action === "publish", "INVALID_PREFLIGHT_ACTION", "Local preflight supports publish; merge requires the injected live GitHub Adapter.");
  assert(changedPaths(root).length === 0, "DIRTY_WORKTREE", "Delivery requires a clean committed worktree.");
  const project = await readProject(root);
  const work = await readWork(root, workId);
  assertBranch(work, currentBranch(root));
  const subject = await subjectFor(root, project, work);
  const evidence = await loadEvidence(root, work, subject.headSha);
  assert(evidenceIsFresh(evidence, subject) && fullRunPassed(evidence, project.checks) && reviewsPassed(evidence), "DELIVERY_NOT_READY", "Fresh verification and both PASS reviews are required.");
  const policy = deliveryPolicy(work.mode.name);
  let authorization = null;
  if (requirePublishAuthorization && policy.publishConfirmationRequired) {
    assert(typeof authorizationSource === "string" && authorizationSource.length > 0, "MISSING_DELIVERY_AUTHORIZATION", "Supervised mode requires explicit authorization before Publish.");
    authorization = { action: "publish", source: auditText(authorizationSource, "authorization-source"), headSha: subject.headSha };
  }
  const result = {
    ok: true,
    action,
    workId,
    subject,
    deliveryPolicy: policy,
    authorization,
    evidenceComment: renderEvidenceComment(work, evidence),
  };
  return result;
}

export async function preflight(root, { workId, action, authorizationSource = undefined }) {
  return localDeliveryPreflight(root, { workId, action, authorizationSource, requirePublishAuthorization: true });
}

export async function mergePreflight(root, { workId, pullRequest, githubAdapter }) {
  const local = await localDeliveryPreflight(root, { workId, action: "publish", requirePublishAuthorization: false });
  assert(githubAdapter && typeof githubAdapter.inspectMerge === "function", "MISSING_GITHUB_ADAPTER", "Merge preflight requires an injected live GitHub Adapter.");
  const repository = assertGitHubAdapterBinding(root, githubAdapter);
  const work = await readWork(root, workId);
  const snapshot = validateGitHubSnapshot(await githubAdapter.inspectMerge({
    pullRequest,
    branch: work.branch,
    baseBranch: work.base.branch,
    headSha: local.subject.headSha,
    baseSha: local.subject.baseSha,
    evidenceComment: local.evidenceComment,
  }), { ...local.subject, repository, branch: work.branch, baseBranch: work.base.branch });
  assertMergeable(snapshot);
  return { ...local, action: "merge", github: snapshot };
}

export async function mergeWhenReady(root, { workId, pullRequest, githubAdapter, method = "squash", authorizationSource = undefined }) {
  const local = await localDeliveryPreflight(root, { workId, action: "publish", requirePublishAuthorization: false });
  assert(githubAdapter && typeof githubAdapter.mergeWhenReady === "function", "MISSING_GITHUB_ADAPTER", "Merge requires an injected live GitHub Adapter with an immediate recheck.");
  assertGitHubAdapterBinding(root, githubAdapter);
  const work = await readWork(root, workId);
  if (work.mode.name !== "autonomous") assert(typeof authorizationSource === "string" && authorizationSource.length > 0, "MISSING_DELIVERY_AUTHORIZATION", `${work.mode.name} mode requires explicit authorization before Merge.`);
  const authorization = work.mode.name === "autonomous" ? null : { action: "merge", source: auditText(authorizationSource, "authorization-source"), headSha: local.subject.headSha };
  const github = await githubAdapter.mergeWhenReady({
    pullRequest,
    branch: work.branch,
    baseBranch: work.base.branch,
    headSha: local.subject.headSha,
    baseSha: local.subject.baseSha,
    evidenceComment: local.evidenceComment,
    method,
  });
  assert(github?.merged === true && isSha(github.mergeSha), "GITHUB_MERGE_FAILED", "GitHub did not return an exact merge SHA.");
  return { ...local, action: "merge", authorization, github };
}

export async function inspectDelivery(root, { workId, pullRequest, githubAdapter }) {
  await checkInstall(root);
  assertRepository(root);
  assert(githubAdapter && typeof githubAdapter.inspectMerge === "function", "MISSING_GITHUB_ADAPTER", "Delivery inspection requires an injected live GitHub Adapter.");
  const repository = assertGitHubAdapterBinding(root, githubAdapter);
  const project = await readProject(root);
  const work = await readWork(root, workId);
  const featureHead = refSha(root, `refs/heads/${work.branch}`) ?? refSha(root, `refs/remotes/origin/${work.branch}`);
  if (featureHead !== null) {
    const evidence = await loadEvidence(root, work, featureHead);
    if (evidence !== null) {
      await validateFreeze(root, work, { descendantSha: featureHead });
      const subject = {
        headSha: featureHead,
        baseSha: evidence.subject.baseSha,
        freezeCommitSha: work.freeze.commitSha,
        specSha256: work.freeze.specSha256,
        frameworkLockSha256: project.frameworkLockSha256,
      };
      const readyEvidence = isSha(subject.baseSha)
        && isAncestor(root, work.base.sha, subject.baseSha)
        && isAncestor(root, subject.baseSha, featureHead)
        && evidenceIsFresh(evidence, subject)
        && fullRunPassed(evidence, project.checks)
        && reviewsPassed(evidence);
      if (readyEvidence) {
        const evidenceComment = renderEvidenceComment(work, evidence);
        const github = validateGitHubSnapshot(await githubAdapter.inspectMerge({
          pullRequest,
          branch: work.branch,
          baseBranch: work.base.branch,
          headSha: featureHead,
          baseSha: subject.baseSha,
          evidenceComment,
        }), { ...subject, repository, branch: work.branch, baseBranch: work.base.branch });
        if (github.merged) {
          assertMerged(github);
          return { nextAction: "done", workId, mergeSha: github.mergeSha, pullRequest };
        }
      }
    }
  }
  const local = await inspect(root, workId);
  if (local.nextAction !== "deliver") return local;
  const merge = await mergePreflight(root, { workId, pullRequest, githubAdapter });
  if (merge.github.merged) return { nextAction: "done", workId, mergeSha: merge.github.mergeSha, pullRequest };
  return { nextAction: "deliver", workId, operation: "merge", pullRequest, github: merge.github };
}
