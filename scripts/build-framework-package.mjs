#!/usr/bin/env node

import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const firstPartySkills = ["setup-project", "define-requirement", "implement-change", "review-change"];
const managedRoots = [
  ".ai-sdlc-framework",
  ...firstPartySkills.map((name) => `.agents/skills/${name}`),
];
const packageExtras = ["README.md", "THIRD_PARTY_NOTICES.md", ".gitattributes", "scripts/install-ai-sdlc.mjs", "scripts/install-matt-skills.mjs"];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function assertNoSymlinkAncestors(relativePath) {
  let cursor = root;
  for (const part of ["", ...relativePath.split("/").filter(Boolean)]) {
    if (part) cursor = path.join(cursor, part);
    try {
      if ((await lstat(cursor)).isSymbolicLink()) throw new Error(`Package path may not traverse a symlink: ${relativePath}`);
    } catch (error) {
      if (error?.code === "ENOENT") break;
      throw error;
    }
  }
}

async function filesBelow(relativePath) {
  const absolute = path.join(root, relativePath);
  const value = await lstat(absolute);
  if (value.isSymbolicLink()) throw new Error(`Package source may not be a symlink: ${relativePath}`);
  if (value.isFile()) return [relativePath.replaceAll(path.sep, "/")];
  const entries = await readdir(absolute, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => filesBelow(path.join(relativePath, entry.name))));
  return nested.flat();
}

const managed = (await Promise.all(managedRoots.map(filesBelow)))
  .flat()
  .filter((entry) => entry !== ".ai-sdlc-framework/manifest.json")
  .sort();
const manifestFiles = {};
for (const relativePath of managed) manifestFiles[relativePath] = sha256(await readFile(path.join(root, relativePath)));
const version = (await readFile(path.join(root, ".ai-sdlc-framework/VERSION"), "utf8")).trim();
const manifest = { schemaVersion: 1, version, files: manifestFiles };
await assertNoSymlinkAncestors(".ai-sdlc-framework/manifest.json");
await writeFile(path.join(root, ".ai-sdlc-framework/manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const stagingParent = await mkdtemp(path.join(tmpdir(), "ai-sdlc-package-"));
const staging = path.join(stagingParent, "AI-SDLC-FRAMEWORK");
const outputDirectory = path.join(root, "dist");
const output = path.join(outputDirectory, "AI-SDLC-FRAMEWORK.zip");
try {
  await mkdir(staging, { recursive: true });
  for (const relativePath of [...managed, ".ai-sdlc-framework/manifest.json", ...packageExtras]) {
    const source = path.join(root, relativePath);
    await assertNoSymlinkAncestors(relativePath);
    const destination = path.join(staging, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination, { force: true });
  }
  await assertNoSymlinkAncestors("dist/AI-SDLC-FRAMEWORK.zip");
  await mkdir(outputDirectory, { recursive: true });
  await rm(output, { force: true });
  const zipped = spawnSync("zip", ["-X", "-q", "-r", output, "AI-SDLC-FRAMEWORK"], {
    cwd: stagingParent,
    encoding: "utf8",
  });
  if (zipped.status !== 0) throw new Error(`zip failed: ${zipped.stderr}`);
  const archiveDigest = sha256(await readFile(output));
  process.stdout.write(`${JSON.stringify({ ok: true, version, output, sha256: archiveDigest, managedFiles: managed.length }, null, 2)}\n`);
} finally {
  await rm(stagingParent, { recursive: true, force: true });
}
