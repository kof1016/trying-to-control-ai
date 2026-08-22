#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { access, lstat, mkdir, mkdtemp, open, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parse(values) {
  const flags = {};
  for (let index = 0; index < values.length; index += 2) flags[values[index].replace(/^--/u, "")] = values[index + 1];
  return flags;
}

function sha256(bytes) {
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

function inside(root, relativePath) {
  const absoluteRoot = path.resolve(root);
  const resolved = path.resolve(absoluteRoot, relativePath);
  const relative = path.relative(absoluteRoot, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Path escapes target: ${relativePath}`);
  return resolved;
}

async function rejectSymlinkPath(root, filePath) {
  const absoluteRoot = path.resolve(root);
  const relative = path.relative(absoluteRoot, path.resolve(filePath));
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Path escapes root: ${filePath}`);
  let cursor = absoluteRoot;
  for (const part of ["", ...relative.split(path.sep).filter(Boolean)]) {
    if (part) cursor = path.join(cursor, part);
    try {
      if ((await lstat(cursor)).isSymbolicLink()) throw new Error(`Refusing a Skill path through a symlink: ${cursor}`);
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

const flags = parse(process.argv.slice(2));
const target = path.resolve(flags.target ?? process.cwd());
const suppliedCheckout = flags.checkout ? path.resolve(flags.checkout) : null;
const lock = JSON.parse(await readFile(path.join(sourceRoot, ".ai-sdlc-framework/locks/matt-skills.lock.json"), "utf8"));
let temporary = null;

try {
  await rejectSymlinkPath(target, target);
  let checkout = suppliedCheckout;
  if (!checkout) {
    temporary = await mkdtemp(path.join(tmpdir(), "matt-skills-install-"));
    checkout = path.join(temporary, "checkout");
    const cloned = spawnSync("git", ["clone", "--quiet", "--depth", "1", "--branch", lock.tag, lock.repository, checkout], { encoding: "utf8" });
    if (cloned.status !== 0) throw new Error(`Unable to download Matt Skills: ${cloned.stderr}`);
  }
  const resolved = spawnSync("git", ["rev-parse", "HEAD"], { cwd: checkout, encoding: "utf8" });
  if (resolved.status !== 0 || resolved.stdout.trim() !== lock.commit) throw new Error(`Matt Skills checkout is not pinned commit ${lock.commit}.`);

  const writes = [];
  const conflicts = [];
  const migratedLegacy = [];
  for (const [skillName, skill] of Object.entries(lock.skills)) {
    const resolvedTree = spawnSync("git", ["rev-parse", `${lock.commit}:${skill.sourcePath}`], { cwd: checkout, encoding: "utf8" });
    if (resolvedTree.status !== 0 || resolvedTree.stdout.trim() !== skill.treeSha) throw new Error(`Upstream tree mismatch: ${skillName}`);
    for (const [relativeFile, expected] of Object.entries(skill.files)) {
      const source = path.join(checkout, skill.sourcePath, relativeFile);
      await rejectSymlinkPath(checkout, source);
      const bytes = await readFile(source);
      const actual = sha256(bytes);
      if (actual !== expected) throw new Error(`Upstream digest mismatch: ${skillName}/${relativeFile}`);
      const destination = inside(target, path.join(".agents/skills", skillName, relativeFile));
      await rejectSymlinkPath(target, destination);
      if (await exists(destination)) {
        const installed = sha256(await readFile(destination));
        const targetRelative = path.relative(target, destination).replaceAll(path.sep, "/");
        if (installed !== expected && !(lock.acceptedLegacyFileDigests?.[targetRelative] ?? []).includes(installed)) {
          conflicts.push(targetRelative);
        } else if (installed !== expected) {
          migratedLegacy.push(targetRelative);
        }
      }
      writes.push({ destination, bytes });
    }
  }
  const noticeSource = path.join(sourceRoot, "THIRD_PARTY_NOTICES.md");
  await rejectSymlinkPath(sourceRoot, noticeSource);
  const noticeBytes = await readFile(noticeSource);
  if (sha256(noticeBytes) !== lock.noticeSha256) throw new Error("Third-party notice digest does not match the Framework lock.");
  const noticeDestination = inside(target, ".agents/skills/THIRD_PARTY_NOTICES.md");
  await rejectSymlinkPath(target, noticeDestination);
  if (await exists(noticeDestination) && sha256(await readFile(noticeDestination)) !== lock.noticeSha256) conflicts.push(path.relative(target, noticeDestination));
  writes.push({ destination: noticeDestination, bytes: noticeBytes });
  if (conflicts.length > 0) throw new Error(`Refusing to overwrite modified third-party Skills: ${conflicts.join(", ")}`);
  for (const write of writes) await atomicWrite(target, write.destination, write.bytes);
  process.stdout.write(`${JSON.stringify({ ok: true, commit: lock.commit, skills: Object.keys(lock.skills), notice: ".agents/skills/THIRD_PARTY_NOTICES.md", migratedLegacy }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ ok: false, message: error.message }, null, 2)}\n`);
  process.exitCode = 1;
} finally {
  if (temporary) await rm(temporary, { recursive: true, force: true });
}
