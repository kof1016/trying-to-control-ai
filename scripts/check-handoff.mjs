#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, "..");

const requiredFiles = [
  ".gitattributes",
  "README.md",
  "AGENTS.md",
  "THIRD_PARTY_NOTICES.md",
  "docs/AUDIT.md",
  "docs/BOOTSTRAP.md",
  "docs/CI-CD.md",
  "docs/REVIEWS.md",
  "docs/RULES.md",
  "docs/SKILLS.md",
  "docs/SOURCES.md",
  "docs/WORKFLOW.md",
  "scripts/check-handoff.mjs",
  "scripts/install-skills.mjs",
  "third_party/matt-pocock-skills.lock.json",
];

const forbiddenPaths = [
  ".ai-sdlc.yml",
  ".github",
  "docs/agents/issue-tracker.md",
  "src",
  "tests",
  "AI-SDLC-DEMO-PROJECT-BLUEPRINT.md",
];

function fail(message) {
  throw new Error(message);
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === ".agents") continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function normalized(path) {
  return relative(root, path).split(sep).join("/");
}

function checkTopology() {
  for (const path of requiredFiles) {
    const absolute = join(root, ...path.split("/"));
    if (!existsSync(absolute) || !statSync(absolute).isFile()) fail(`Missing required file: ${path}`);
  }
  for (const path of forbiddenPaths) {
    if (existsSync(join(root, ...path.split("/")))) fail(`Phase-one package contains forbidden path: ${path}`);
  }
}

function checkMarkdownLinks(files) {
  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
  let localLinks = 0;
  let externalLinks = 0;

  for (const file of files.filter((path) => extname(path) === ".md")) {
    const contents = readFileSync(file, "utf8");
    for (const match of contents.matchAll(linkPattern)) {
      const rawTarget = match[1].trim().split(/\s+"/)[0];
      if (rawTarget.startsWith("#")) continue;
      if (/^https:\/\//.test(rawTarget)) {
        new URL(rawTarget);
        externalLinks += 1;
        continue;
      }
      if (/^[a-z][a-z0-9+.-]*:/i.test(rawTarget)) {
        fail(`Non-HTTPS or unsupported link in ${normalized(file)}: ${rawTarget}`);
      }

      const targetWithoutAnchor = rawTarget.split("#")[0];
      if (targetWithoutAnchor.length === 0) continue;
      const target = resolve(dirname(file), targetWithoutAnchor);
      if (target !== root && !target.startsWith(`${root}${sep}`)) {
        fail(`Local link escapes package in ${normalized(file)}: ${rawTarget}`);
      }
      if (!existsSync(target)) fail(`Broken local link in ${normalized(file)}: ${rawTarget}`);
      localLinks += 1;
    }
  }
  return { localLinks, externalLinks };
}

function checkAuthorityAndScope() {
  const readme = readFileSync(join(root, "README.md"), "utf8");
  if (!readme.includes("取代所有 v1 ZIP")) fail("README lacks an explicit v1 supersession statement.");
  if (
    !/本包沒有：[\s\S]{0,500}- 實作 A\+B。/.test(readme) ||
    !/本包沒有：[\s\S]{0,700}- 建立 `\.github\/workflows\/`/.test(readme)
  ) {
    fail("README does not state the phase-one exclusions.");
  }

  const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
  if (agents.split(/\r?\n/).length > 20) fail("AGENTS.md is no longer a minimal index.");
  if (/npx|git commit|issue-tracker|Approval Gate/.test(agents)) {
    fail("AGENTS.md contains implementation detail instead of routing only.");
  }

  const installer = readFileSync(join(root, "scripts", "install-skills.mjs"), "utf8");
  if (/skills@latest|mattpocock\/skills#/.test(installer)) fail("Installer contains an unpinned source.");
}

function checkSkillLock() {
  const lockPath = join(root, "third_party", "matt-pocock-skills.lock.json");
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  const names = lock.installation?.skills?.map((skill) => skill.name);
  const expectedNames = ["grilling", "tdd", "codebase-design"];
  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) fail("Skill lock is not the exact three-item whitelist.");
  if (
    lock.schema_version !== 2 ||
    lock.installer?.type !== "repository-script" ||
    lock.installer?.path !== "scripts/install-skills.mjs" ||
    lock.installer?.executes_third_party_code !== false
  ) {
    fail("Skill installer is not the locked repo-owned implementation.");
  }
  if (
    lock.audit?.installer_discovered_count !== 35 ||
    lock.audit?.promoted_count !== 25 ||
    lock.audit?.discovered_skills?.length !== 35 ||
    new Set(lock.audit?.discovered_skills).size !== 35
  ) {
    fail("Skill lock does not preserve the complete 35-item audit set.");
  }
  if (lock.source?.commit !== "0ab1b63a410a03d3627979a109c8695de27af954") {
    fail("Matt Skills source commit is not pinned correctly.");
  }

  const selfCheck = spawnSync(process.execPath, [join(root, "scripts", "install-skills.mjs"), "--self-check"], {
    cwd: root,
    encoding: "utf8",
  });
  if (selfCheck.status !== 0) {
    fail(`Skill installer self-check failed:\n${selfCheck.stdout}${selfCheck.stderr}`);
  }
}

try {
  checkTopology();
  const files = walk(root);
  checkAuthorityAndScope();
  checkSkillLock();
  const links = checkMarkdownLinks(files);
  console.log(
    `Handoff package passed: ${files.length} files, ${links.localLinks} local links, ${links.externalLinks} HTTPS links.`,
  );
} catch (error) {
  console.error(`Handoff check failed: ${error.message}`);
  process.exitCode = 1;
}
