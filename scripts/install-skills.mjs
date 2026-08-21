#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = realpathSync(resolve(scriptDirectory, ".."));
const lockPath = join(repositoryRoot, "third_party", "matt-pocock-skills.lock.json");
const maximumFileBytes = 2 * 1024 * 1024;

const expected = Object.freeze({
  schemaVersion: 2,
  minimumNode: "20.0.0",
  sourceCommit: "0ab1b63a410a03d3627979a109c8695de27af954",
  rawBase:
    "https://raw.githubusercontent.com/mattpocock/skills/0ab1b63a410a03d3627979a109c8695de27af954",
  target: ".agents/skills",
  skills: ["grilling", "tdd", "codebase-design"],
});

function fail(message) {
  throw new Error(message);
}

function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

function assertRuntime() {
  if (compareVersions(process.versions.node, expected.minimumNode) < 0) {
    fail(`Node.js ${expected.minimumNode} or newer is required; found ${process.versions.node}.`);
  }
}

function assertSafeRelativePath(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\\") ||
    value.startsWith("/") ||
    value.split("/").includes("..")
  ) {
    fail(`${label} is not a safe relative path: ${String(value)}`);
  }
}

function isWithin(base, target) {
  const difference = relative(base, target);
  return difference === "" || (!isAbsolute(difference) && difference !== ".." && !difference.startsWith(`..${sep}`));
}

function assertNoSymlinkPath(base, target, label) {
  if (!isWithin(base, target)) fail(`${label} escapes its trusted root: ${target}`);
  const parts = relative(base, target).split(sep).filter(Boolean);
  let current = base;
  for (let index = 0; index < parts.length; index += 1) {
    current = join(current, parts[index]);
    if (!existsSync(current)) continue;
    const stats = lstatSync(current);
    if (stats.isSymbolicLink()) fail(`${label} contains a symlink: ${current}`);
    if (index < parts.length - 1 && !stats.isDirectory()) {
      fail(`${label} has a non-directory ancestor: ${current}`);
    }
  }
  if (existsSync(target) && !isWithin(base, realpathSync(target))) {
    fail(`${label} resolves outside its trusted root: ${target}`);
  }
}

function loadAndValidateLock() {
  if (!existsSync(lockPath)) fail(`Missing lock file: ${lockPath}`);
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));

  if (lock.schema_version !== expected.schemaVersion) fail("Unsupported Skill lock schema.");
  if (
    lock.installer?.type !== "repository-script" ||
    lock.installer?.path !== "scripts/install-skills.mjs" ||
    lock.installer?.minimum_node !== expected.minimumNode ||
    lock.installer?.executes_third_party_code !== false
  ) {
    fail("Unexpected repo-owned installer contract.");
  }
  if (lock.source?.commit !== expected.sourceCommit) fail("Unexpected Matt Skills commit.");
  if (lock.source?.raw_base !== expected.rawBase) fail("Raw source URL does not match the pinned commit.");
  if (
    lock.source?.archive !==
    `https://github.com/mattpocock/skills/archive/${expected.sourceCommit}.tar.gz`
  ) {
    fail("Audit archive URL does not match the pinned commit.");
  }
  const rawURL = new URL(lock.source.raw_base);
  if (rawURL.protocol !== "https:" || rawURL.hostname !== "raw.githubusercontent.com") {
    fail("Pinned file source must use HTTPS raw.githubusercontent.com.");
  }
  if (lock.installation?.target !== expected.target) fail("Unexpected install target.");
  if (lock.installation?.agent !== "codex" || lock.installation?.mode !== "copy") {
    fail("Skill lock must target Codex in copy mode.");
  }

  const skills = lock.installation?.skills;
  if (!Array.isArray(skills)) fail("Skill list is missing.");
  const names = skills.map((skill) => skill.name);
  if (JSON.stringify(names) !== JSON.stringify(expected.skills)) {
    fail(`Expected exactly these Skills in this order: ${expected.skills.join(", ")}.`);
  }

  const discovered = lock.audit?.discovered_skills;
  if (
    lock.audit?.installer_discovered_count !== 35 ||
    lock.audit?.promoted_count !== 25 ||
    !Array.isArray(discovered) ||
    discovered.length !== 35 ||
    new Set(discovered).size !== 35
  ) {
    fail("The audited 35-Skill candidate set is incomplete.");
  }
  if (
    lock.audit?.discovery_tool?.package !== "skills" ||
    lock.audit?.discovery_tool?.version !== "1.5.23" ||
    !/^sha512-[A-Za-z0-9+/=]+$/.test(lock.audit?.discovery_tool?.npm_integrity ?? "")
  ) {
    fail("The audit-only discovery tool record is incomplete.");
  }

  for (const name of discovered) {
    if (!/^[a-z0-9-]+$/.test(name)) fail(`Invalid audited Skill name: ${String(name)}`);
  }
  for (const name of expected.skills) {
    if (!discovered.includes(name)) fail(`Selected Skill is absent from audited candidates: ${name}`);
  }

  for (const skill of skills) {
    if (!/^[a-z0-9-]+$/.test(skill.name)) fail(`Invalid Skill name: ${String(skill.name)}`);
    assertSafeRelativePath(skill.upstream_path, `${skill.name} upstream path`);
    if (!/^[0-9a-f]{40}$/.test(skill.git_tree ?? "")) fail(`Invalid Git tree for ${skill.name}.`);
    if (!Array.isArray(skill.files) || skill.files.length === 0) fail(`No files locked for ${skill.name}.`);

    const paths = new Set();
    for (const file of skill.files) {
      assertSafeRelativePath(file.path, `${skill.name} file path`);
      if (paths.has(file.path)) fail(`Duplicate file in lock: ${skill.name}/${file.path}`);
      paths.add(file.path);
      if (!/^[0-9a-f]{64}$/.test(file.sha256 ?? "")) fail(`Invalid SHA-256 for ${skill.name}/${file.path}.`);
    }
    if (!paths.has("SKILL.md") || !paths.has("agents/openai.yaml")) {
      fail(`${skill.name} must lock SKILL.md and agents/openai.yaml.`);
    }
  }

  return lock;
}

function listFiles(directory, root = directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isSymbolicLink()) fail(`Symlinks are not accepted in installed Skills: ${absolute}`);
    if (entry.isDirectory()) files.push(...listFiles(absolute, root));
    else if (entry.isFile()) files.push(relative(root, absolute).split(sep).join("/"));
    else fail(`Unsupported filesystem entry in Skill: ${absolute}`);
  }
  return files.sort();
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256File(path) {
  return sha256Bytes(readFileSync(path));
}

function verifySkill(directory, skill, trustedRoot) {
  assertNoSymlinkPath(trustedRoot, directory, `${skill.name} path`);
  if (!existsSync(directory)) fail(`Missing installed Skill: ${skill.name}`);
  if (!lstatSync(directory).isDirectory()) fail(`Skill target is not a directory: ${directory}`);

  const actualPaths = listFiles(directory);
  const expectedPaths = skill.files.map((file) => file.path).sort();
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    fail(
      `${skill.name} file set differs from lock.\nExpected: ${expectedPaths.join(", ")}\nActual: ${actualPaths.join(", ")}`,
    );
  }

  for (const file of skill.files) {
    const actualHash = sha256File(join(directory, ...file.path.split("/")));
    if (actualHash !== file.sha256) fail(`${skill.name}/${file.path} SHA-256 mismatch.`);
  }
}

function targetRootFor(lock) {
  const targetRoot = join(repositoryRoot, ...lock.installation.target.split("/"));
  assertNoSymlinkPath(repositoryRoot, targetRoot, "Skill target root");
  return targetRoot;
}

function assertNoUnselectedMattSkills(targetRoot, lock) {
  assertNoSymlinkPath(repositoryRoot, targetRoot, "Skill target root");
  const selected = new Set(lock.installation.skills.map((skill) => skill.name));
  const extras = lock.audit.discovered_skills.filter(
    (name) => !selected.has(name) && existsSync(join(targetRoot, name)),
  );
  if (extras.length > 0) {
    fail(
      `Unselected Matt Skill candidates already exist: ${extras.join(", ")}. ` +
        "They were not deleted; inspect provenance and remove only with authorization.",
    );
  }
}

function verifyInstalled(lock) {
  const targetRoot = targetRootFor(lock);
  assertNoUnselectedMattSkills(targetRoot, lock);
  for (const skill of lock.installation.skills) {
    verifySkill(join(targetRoot, skill.name), skill, repositoryRoot);
  }
  console.log(`Verified ${lock.installation.skills.length} pinned repo Skills.`);
}

function encodedPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function fetchLockedFile(lock, skill, file) {
  const url = `${lock.source.raw_base}/${encodedPath(skill.upstream_path)}/${encodedPath(file.path)}`;
  const response = await fetch(url, {
    headers: { "user-agent": "ai-sdlc-demo-skill-installer/2" },
    redirect: "follow",
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) fail(`Download failed (${response.status}) for ${skill.name}/${file.path}.`);
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > maximumFileBytes) fail(`Locked file is unexpectedly large: ${skill.name}/${file.path}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maximumFileBytes) fail(`Locked file is unexpectedly large: ${skill.name}/${file.path}.`);
  if (sha256Bytes(bytes) !== file.sha256) fail(`Downloaded SHA-256 mismatch: ${skill.name}/${file.path}.`);
  return bytes;
}

async function stageSkills(lock, stagingRoot) {
  const stagedSkills = join(stagingRoot, "skills");
  mkdirSync(stagedSkills, { recursive: true });
  for (const skill of lock.installation.skills) {
    const skillRoot = join(stagedSkills, skill.name);
    for (const file of skill.files) {
      const destination = join(skillRoot, ...file.path.split("/"));
      assertNoSymlinkPath(stagingRoot, destination, "Staged Skill path");
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, await fetchLockedFile(lock, skill, file), { flag: "wx", mode: 0o644 });
    }
    verifySkill(skillRoot, skill, stagingRoot);
  }
  return stagedSkills;
}

async function install(lock) {
  const targetRoot = targetRootFor(lock);
  assertNoUnselectedMattSkills(targetRoot, lock);
  const missing = [];

  for (const skill of lock.installation.skills) {
    const target = join(targetRoot, skill.name);
    if (existsSync(target)) verifySkill(target, skill, repositoryRoot);
    else missing.push(skill);
  }

  if (missing.length === 0) {
    verifyInstalled(lock);
    console.log("Pinned Skills are already installed; no files changed.");
    return;
  }

  const stagingRoot = realpathSync(mkdtempSync(join(tmpdir(), "ai-sdlc-skills-")));
  try {
    const stagedSkills = await stageSkills(lock, stagingRoot);
    assertNoSymlinkPath(repositoryRoot, targetRoot, "Skill target root");
    mkdirSync(targetRoot, { recursive: true });
    assertNoSymlinkPath(repositoryRoot, targetRoot, "Skill target root");

    for (const skill of missing) {
      const source = join(stagedSkills, skill.name);
      const target = join(targetRoot, skill.name);
      const temporaryTarget = join(targetRoot, `.${skill.name}.installing-${process.pid}`);
      assertNoSymlinkPath(repositoryRoot, temporaryTarget, "Temporary Skill target");
      if (existsSync(temporaryTarget) || existsSync(target)) {
        fail(`Skill target appeared during installation: ${target}`);
      }
      try {
        cpSync(source, temporaryTarget, { recursive: true, errorOnExist: true, force: false });
        verifySkill(temporaryTarget, skill, repositoryRoot);
        assertNoSymlinkPath(repositoryRoot, targetRoot, "Skill target root");
        if (existsSync(target)) fail(`Skill target appeared during installation: ${target}`);
        renameSync(temporaryTarget, target);
        verifySkill(target, skill, repositoryRoot);
      } finally {
        if (existsSync(temporaryTarget)) rmSync(temporaryTarget, { recursive: true, force: true });
      }
    }
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }

  verifyInstalled(lock);
  console.log("Installed the exact pinned Skill whitelist without executing third-party installer code.");
}

try {
  assertRuntime();
  const lock = loadAndValidateLock();
  const flags = process.argv.slice(2);
  if (flags.some((flag) => !["--verify", "--self-check"].includes(flag)) || flags.length > 1) {
    fail("Usage: node scripts/install-skills.mjs [--verify|--self-check]");
  }
  if (flags[0] === "--self-check") console.log("Skill installer and lock pins are internally consistent.");
  else if (flags[0] === "--verify") verifyInstalled(lock);
  else await install(lock);
} catch (error) {
  console.error(`Skill setup failed: ${error.message}`);
  process.exitCode = 1;
}
