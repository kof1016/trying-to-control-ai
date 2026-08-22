import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

import { FrameworkError, assert } from "./utils.mjs";

export function git(root, args, { allowFailure = false, input = undefined } = {}) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    input,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (!allowFailure && result.status !== 0) {
    throw new FrameworkError("GIT_FAILED", `git ${args.join(" ")} failed.`, {
      exitCode: result.status,
      stderr: result.stderr.trim(),
    });
  }
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function assertRepository(root) {
  const result = git(root, ["rev-parse", "--is-inside-work-tree"], { allowFailure: true });
  assert(result.exitCode === 0 && result.stdout.trim() === "true", "NOT_GIT_REPOSITORY", `Not a Git repository: ${root}`);
}

export function headSha(root) {
  const result = git(root, ["rev-parse", "HEAD"], { allowFailure: true });
  return result.exitCode === 0 ? result.stdout.trim() : null;
}

export function currentBranch(root) {
  const result = git(root, ["symbolic-ref", "--quiet", "--short", "HEAD"], { allowFailure: true });
  assert(result.exitCode === 0, "DETACHED_HEAD", "AI-SDLC work requires a named feature branch.");
  return result.stdout.trim();
}

export function refSha(root, ref) {
  const result = git(root, ["rev-parse", "--verify", "--end-of-options", ref], { allowFailure: true });
  return result.exitCode === 0 ? result.stdout.trim() : null;
}

export function isAncestor(root, ancestor, descendant) {
  if (!ancestor || !descendant) return false;
  return git(root, ["merge-base", "--is-ancestor", ancestor, descendant], { allowFailure: true }).exitCode === 0;
}

export function changedPaths(root) {
  const records = git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]).stdout.split("\0");
  const paths = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record.length === 0) continue;
    assert(record.length >= 4 && record[2] === " ", "GIT_STATUS_PARSE_FAILED", "Git returned an invalid porcelain status record.");
    const status = record.slice(0, 2);
    paths.push(record.slice(3));
    if (/[RC]/u.test(status)) {
      index += 1;
      assert(typeof records[index] === "string" && records[index].length > 0, "GIT_STATUS_PARSE_FAILED", "Git omitted a rename or copy source path.");
      paths.push(records[index]);
    }
  }
  return [...new Set(paths)].sort();
}

export function worktreeSha256(root) {
  const digest = createHash("sha256");
  digest.update(git(root, ["diff", "--binary", "--no-ext-diff", "HEAD", "--"]).stdout);
  const untracked = git(root, ["ls-files", "--others", "--exclude-standard", "-z"]).stdout.split("\0").filter(Boolean).sort();
  for (const relativePath of untracked) {
    const object = git(root, ["hash-object", "--no-filters", "--", relativePath]).stdout.trim();
    digest.update(`\0${relativePath}\0${object}`);
  }
  return digest.digest("hex");
}

export function stagedPaths(root) {
  const records = git(root, ["diff", "--cached", "--name-status", "-z"]).stdout.split("\0");
  const paths = [];
  for (let index = 0; index < records.length;) {
    const status = records[index];
    index += 1;
    if (status.length === 0) continue;
    assert(/^[A-Z][0-9]*$/u.test(status), "GIT_DIFF_PARSE_FAILED", `Git returned an unsupported staged status: ${status}`);
    const first = records[index];
    index += 1;
    assert(typeof first === "string" && first.length > 0, "GIT_DIFF_PARSE_FAILED", "Git omitted a staged path.");
    paths.push(first);
    if (/^[CR]/u.test(status)) {
      const second = records[index];
      index += 1;
      assert(typeof second === "string" && second.length > 0, "GIT_DIFF_PARSE_FAILED", "Git omitted a staged rename or copy destination.");
      paths.push(second);
    }
  }
  return [...new Set(paths)].sort();
}

export function commitPaths(root, commit) {
  return git(root, ["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", commit]).stdout.split("\n").filter(Boolean);
}

export function lastCommitForPath(root, relativePath) {
  const result = git(root, ["log", "-n", "1", "--format=%H", "--", relativePath], { allowFailure: true });
  return result.exitCode === 0 && result.stdout.trim() ? result.stdout.trim() : null;
}

export function showFile(root, commit, relativePath) {
  const result = git(root, ["show", `${commit}:${relativePath}`], { allowFailure: true });
  assert(result.exitCode === 0, "GIT_FILE_MISSING", `${relativePath} does not exist in ${commit}.`);
  return result.stdout;
}

export function commitExact(root, paths, message) {
  assert(paths.length > 0, "NO_COMMIT_PATHS", "No paths were provided for commit.");
  git(root, ["add", "--", ...paths]);
  const staged = stagedPaths(root);
  assert(staged.length > 0, "EMPTY_COMMIT", "The requested commit has no staged changes.");
  const allowed = new Set(paths);
  const unexpected = staged.filter((entry) => !allowed.has(entry));
  assert(unexpected.length === 0, "UNEXPECTED_STAGED_PATH", "Unexpected staged paths would enter the commit.", { unexpected });
  git(root, ["commit", "-m", message]);
  return headSha(root);
}
