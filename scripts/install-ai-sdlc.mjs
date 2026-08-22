#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { access, lstat, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";

const LEGACY_FILES = {
  ".ai-sdlc/WORKFLOW.md": [
    "22322ec8c9f3d7d9b5909cf9d376b493ef7ef6ba14ad134c3958f5542005aa55",
    "02fa6d93471d1ad5ff78ad5039cf9a2c2e44e812b3c41c4b5875448d9826e06e",
  ],
  ".ai-sdlc/templates/AGENTS.block.md": [
    "e48e27ec8d519731db8c251ceebdee752b8a2701ab4696a36a7fef66d091bbb9",
    "27f9cab1f2d9a6d3850bc28c4101de1643fa1f92d936fe2fba0d43f45488d6eb",
  ],
  ".ai-sdlc/templates/PULL_REQUEST.md": ["4924f67d16a55c9bf7ddecc418226bcf77959584bf4f556a7f71fcc2df6cfdfb"],
  ".ai-sdlc/templates/SPEC.md": ["26023f65c4a3de8528fbcba64bc79c1dc27e970898747836c821b9ebc7595a1b"],
};

function fail(code, message, details = undefined) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  throw error;
}

function args(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    if (!values[index].startsWith("--")) continue;
    result[values[index].slice(2)] = values[index + 1];
    index += 1;
  }
  return result;
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function inside(root, relativePath) {
  const absoluteRoot = path.resolve(root);
  const resolved = path.resolve(absoluteRoot, relativePath);
  const relative = path.relative(absoluteRoot, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) fail("PATH_ESCAPE", `Managed path escapes or aliases the target root: ${relativePath}`);
  return resolved;
}

async function rejectSymlinkPath(root, filePath) {
  const absoluteRoot = path.resolve(root);
  const resolved = path.resolve(filePath);
  const relative = path.relative(absoluteRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) fail("PATH_ESCAPE", `Path escapes root: ${resolved}`);
  let cursor = absoluteRoot;
  const parts = relative ? relative.split(path.sep) : [];
  for (const part of ["", ...parts]) {
    if (part) cursor = path.join(cursor, part);
    try {
      const value = await lstat(cursor);
      if (value.isSymbolicLink()) fail("SYMLINK_PATH", `Refusing a Framework path through a symlink: ${cursor}`);
    } catch (error) {
      if (error?.code === "ENOENT") break;
      throw error;
    }
  }
}

async function atomicWrite(root, filePath, bytes) {
  await rejectSymlinkPath(root, filePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${randomUUID()}`;
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.close();
    handle = undefined;
    await rename(temporary, filePath);
  } finally {
    if (handle) await handle.close();
    await rm(temporary, { force: true });
  }
}

function replaceMarkedBlock(original, block) {
  const start = "<!-- ai-sdlc-framework:begin -->";
  const end = "<!-- ai-sdlc-framework:end -->";
  const startIndex = original.indexOf(start);
  const endIndex = original.indexOf(end);
  if (startIndex === -1 && endIndex === -1) {
    const separator = original.length === 0 ? "" : original.endsWith("\n\n") ? "" : original.endsWith("\n") ? "\n" : "\n\n";
    return `${original}${separator}${block.trim()}\n`;
  }
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) fail("INVALID_AGENTS_MARKER", "AGENTS.md has an incomplete AI-SDLC marker block.");
  return `${original.slice(0, startIndex)}${block.trim()}${original.slice(endIndex + end.length)}`;
}

function replaceLineBlock(original, block, start, end) {
  const startIndex = original.indexOf(start);
  const endIndex = original.indexOf(end);
  if (startIndex === -1 && endIndex === -1) {
    const separator = original.length === 0 ? "" : original.endsWith("\n\n") ? "" : original.endsWith("\n") ? "\n" : "\n\n";
    return `${original}${separator}${block}\n`;
  }
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) fail("INVALID_MARKER", `Incomplete marker block: ${start}`);
  return `${original.slice(0, startIndex)}${block}${original.slice(endIndex + end.length)}`;
}

async function planLegacyMigration(target) {
  const present = [];
  const migrationRoot = inside(target, ".ai-sdlc/migrations/legacy-monolithic-v2.1");
  for (const [relativePath, accepted] of Object.entries(LEGACY_FILES)) {
    const sourcePath = inside(target, relativePath);
    await rejectSymlinkPath(target, sourcePath);
    if (!(await exists(sourcePath))) continue;
    const actual = digest(await readFile(sourcePath));
    if (!accepted.includes(actual)) fail("LEGACY_MIGRATION_REQUIRED", `Legacy Framework file was locally changed: ${relativePath}`, { actual });
    const destination = path.join(migrationRoot, relativePath.replace(/^\.ai-sdlc\//u, ""));
    await rejectSymlinkPath(target, destination);
    if (await exists(destination)) fail("LEGACY_MIGRATION_CONFLICT", `Migration destination already exists: ${destination}`);
    present.push({ relativePath, sourcePath, destination, actual });
  }
  const migrationPath = path.join(migrationRoot, "migration.json");
  await rejectSymlinkPath(target, migrationPath);
  if (present.length > 0 && await exists(migrationPath)) fail("LEGACY_MIGRATION_CONFLICT", `Migration receipt already exists: ${migrationPath}`);
  return { present, migrationPath };
}

async function applyLegacyMigration(target, plan) {
  if (plan.present.length === 0) return false;
  for (const item of plan.present) {
    await mkdir(path.dirname(item.destination), { recursive: true });
    await rename(item.sourcePath, item.destination);
  }
  await atomicWrite(target, plan.migrationPath, `${JSON.stringify({
    schemaVersion: 1,
    from: "monolithic-workflow",
    to: "evidence-derived-router",
    files: Object.fromEntries(plan.present.map((item) => [item.relativePath, item.actual])),
    migratedAt: new Date().toISOString(),
  }, null, 2)}\n`);
  return true;
}

const options = args(process.argv.slice(2));
const source = path.resolve(options.source ?? ".");
const target = path.resolve(options.target ?? process.cwd());

try {
  await rejectSymlinkPath(source, source);
  await rejectSymlinkPath(target, target);
  const manifestPath = inside(source, ".ai-sdlc-framework/manifest.json");
  await rejectSymlinkPath(source, manifestPath);
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  if (manifest.schemaVersion !== 1 || !/^\d+\.\d+\.\d+$/u.test(manifest.version) || !manifest.files || typeof manifest.files !== "object") fail("INVALID_MANIFEST", "Framework manifest is invalid.");
  const sourceFiles = new Map();
  for (const [relativePath, expected] of Object.entries(manifest.files)) {
    const sourcePath = inside(source, relativePath);
    await rejectSymlinkPath(source, sourcePath);
    const bytes = await readFile(sourcePath);
    const actual = digest(bytes);
    if (actual !== expected) fail("SOURCE_DRIFT", `Source file does not match manifest: ${relativePath}`, { expected, actual });
    sourceFiles.set(relativePath, bytes);
  }

  const lockPath = inside(target, ".ai-sdlc/framework.lock.json");
  await rejectSymlinkPath(target, lockPath);
  const oldLock = (await exists(lockPath)) ? await readJson(lockPath) : null;
  const removed = oldLock ? Object.keys(oldLock.managedFiles ?? {}).filter((entry) => !sourceFiles.has(entry)) : [];
  if (removed.length > 0) fail("MIGRATION_REQUIRED", "Update removes managed files and requires an explicit migration.", { removed });

  const conflicts = [];
  for (const [relativePath, bytes] of sourceFiles) {
    const destination = inside(target, relativePath);
    await rejectSymlinkPath(target, destination);
    if (!(await exists(destination))) continue;
    const actual = digest(await readFile(destination));
    const previous = oldLock?.managedFiles?.[relativePath];
    const next = digest(bytes);
    if (actual !== next && (!previous || actual !== previous)) conflicts.push(relativePath);
  }
  if (conflicts.length > 0) fail("MANAGED_FILE_DRIFT", "Refusing to overwrite locally modified Framework files.", { conflicts });

  const agentsBlock = await readFile(inside(source, ".ai-sdlc-framework/templates/AGENTS.block.md"), "utf8");
  const agentsPath = inside(target, "AGENTS.md");
  const attributesPath = inside(target, ".gitattributes");
  const runtimeIgnorePath = inside(target, ".ai-sdlc/.gitignore");
  const projectPath = inside(target, ".ai-sdlc/project.json");
  for (const plannedPath of [agentsPath, attributesPath, runtimeIgnorePath, projectPath]) await rejectSymlinkPath(target, plannedPath);
  const agentsOriginal = (await exists(agentsPath)) ? await readFile(agentsPath, "utf8") : "";
  const agentsNext = replaceMarkedBlock(agentsOriginal, agentsBlock);
  const attributesStart = "# ai-sdlc-framework:begin";
  const attributesEnd = "# ai-sdlc-framework:end";
  const attributesBlock = [
    attributesStart,
    ".ai-sdlc/**/*.md text eol=lf",
    ".ai-sdlc/**/*.json text eol=lf",
    ".ai-sdlc-framework/** text eol=lf",
    ".agents/skills/** text eol=lf",
    attributesEnd,
  ].join("\n");
  const attributesOriginal = (await exists(attributesPath)) ? await readFile(attributesPath, "utf8") : "";
  const attributesNext = replaceLineBlock(attributesOriginal, attributesBlock, attributesStart, attributesEnd);
  const ignored = (await exists(runtimeIgnorePath)) ? await readFile(runtimeIgnorePath, "utf8") : "";
  const ignoredNext = ignored.split(/\r?\n/u).includes("local/") ? ignored : `${ignored}${ignored.length > 0 && !ignored.endsWith("\n") ? "\n" : ""}local/\n`;

  const managedFiles = Object.fromEntries([...sourceFiles].map(([relativePath, bytes]) => [relativePath, digest(bytes)]));
  const manifestSha256 = digest(manifestBytes);
  const sameInstall = oldLock?.schemaVersion === 1
    && oldLock.frameworkVersion === manifest.version
    && oldLock.manifestSha256 === manifestSha256
    && JSON.stringify(oldLock.managedFiles) === JSON.stringify(managedFiles);
  const lock = {
    schemaVersion: 1,
    frameworkVersion: manifest.version,
    manifestSha256,
    managedFiles,
    installedAt: sameInstall && typeof oldLock.installedAt === "string" ? oldLock.installedAt : new Date().toISOString(),
  };
  const lockBytes = `${JSON.stringify(lock, null, 2)}\n`;

  let projectNext = null;
  let projectUpdated = false;
  if (await exists(projectPath)) {
    const project = await readJson(projectPath);
    if (!project || typeof project !== "object" || Array.isArray(project) || typeof project.projectId !== "string" || !Array.isArray(project.checks)) fail("INVALID_PROJECT", "Cannot update an invalid .ai-sdlc/project.json.");
    if (project.frameworkVersion !== manifest.version || project.frameworkLockSha256 !== manifestSha256) {
      project.frameworkVersion = manifest.version;
      project.frameworkLockSha256 = manifestSha256;
      projectNext = `${JSON.stringify(project, null, 2)}\n`;
      projectUpdated = true;
    }
  }
  const migrationPlan = await planLegacyMigration(target);

  const migratedLegacy = await applyLegacyMigration(target, migrationPlan);
  for (const [relativePath, bytes] of sourceFiles) await atomicWrite(target, inside(target, relativePath), bytes);
  await atomicWrite(target, inside(target, ".ai-sdlc-framework/manifest.json"), manifestBytes);
  await atomicWrite(target, agentsPath, agentsNext);
  await atomicWrite(target, attributesPath, attributesNext);
  await atomicWrite(target, runtimeIgnorePath, ignoredNext);
  await atomicWrite(target, lockPath, lockBytes);
  if (projectNext !== null) await atomicWrite(target, projectPath, projectNext);
  process.stdout.write(`${JSON.stringify({ ok: true, target, version: manifest.version, files: sourceFiles.size, migratedLegacy, projectUpdated }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ ok: false, code: error.code ?? "INSTALL_FAILED", message: error.message, details: error.details }, null, 2)}\n`);
  process.exitCode = 1;
}
