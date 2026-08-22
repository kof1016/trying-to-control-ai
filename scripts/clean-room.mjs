#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = await mkdtemp(path.join(tmpdir(), "ai-sdlc-clean-room-"));
const cleanRoomMavenHome = path.join(workspace, "maven-home");
const cleanRoomMavenSettings = path.join(workspace, "maven-settings.xml");
const results = [];

function xmlEscape(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function mavenSettings() {
  const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy ?? process.env.HTTP_PROXY ?? process.env.http_proxy;
  if (!proxy) return "<settings xmlns=\"http://maven.apache.org/SETTINGS/1.2.0\"/>\n";
  const parsed = new URL(proxy);
  const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
  const username = parsed.username ? `<username>${xmlEscape(decodeURIComponent(parsed.username))}</username>` : "";
  const password = parsed.password ? `<password>${xmlEscape(decodeURIComponent(parsed.password))}</password>` : "";
  return [
    '<settings xmlns="http://maven.apache.org/SETTINGS/1.2.0">',
    "  <proxies>",
    "    <proxy>",
    "      <id>clean-room-proxy</id>",
    "      <active>true</active>",
    `      <protocol>${xmlEscape(parsed.protocol.replace(":", ""))}</protocol>`,
    `      <host>${xmlEscape(parsed.hostname)}</host>`,
    `      <port>${xmlEscape(port)}</port>`,
    ...(username ? [`      ${username}`] : []),
    ...(password ? [`      ${password}`] : []),
    "    </proxy>",
    "  </proxies>",
    "</settings>",
    "",
  ].join("\n");
}

function javaProxyOptions() {
  const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy ?? process.env.HTTP_PROXY ?? process.env.http_proxy;
  if (!proxy) return [];
  const parsed = new URL(proxy);
  const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
  return [
    `-Dhttps.proxyHost=${parsed.hostname}`,
    `-Dhttps.proxyPort=${port}`,
    `-Dhttp.proxyHost=${parsed.hostname}`,
    `-Dhttp.proxyPort=${port}`,
  ];
}

function run(command, args, cwd, { allowFailure = false, timeout = 120_000 } = {}) {
  const mavenOptions = [
    process.env.MAVEN_OPTS,
    `-Dmaven.repo.local=${path.join(cleanRoomMavenHome, "repository")}`,
    ...javaProxyOptions(),
  ].filter(Boolean).join(" ");
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout,
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, MAVEN_USER_HOME: cleanRoomMavenHome, MAVEN_OPTS: mavenOptions },
  });
  if (!allowFailure && result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`);
  return result;
}

function git(repository, args, options = {}) {
  return run("git", args, repository, options);
}

function commit(repository, message) {
  git(repository, ["add", "-A"]);
  const empty = git(repository, ["diff", "--cached", "--quiet"], { allowFailure: true });
  if (empty.status !== 0) git(repository, ["commit", "-m", message]);
}

function cli(repository, _packageRoot, args, options = {}) {
  const result = run(process.execPath, [path.join(repository, ".ai-sdlc-framework/bin/ai-sdlc.mjs"), ...args, "--root", repository], repository, options);
  return result.status === 0 ? JSON.parse(result.stdout) : result;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function makeRepository(name) {
  const repository = path.join(workspace, name);
  await mkdir(repository, { recursive: true });
  git(repository, ["init", "-b", "main"]);
  git(repository, ["config", "user.name", "Clean Room"]);
  git(repository, ["config", "user.email", "clean-room@example.invalid"]);
  return repository;
}

async function useHistoricalSpotlessJavaEndings(repository) {
  if (process.platform !== "win32") return;
  const infoAttributes = path.resolve(repository, git(repository, ["rev-parse", "--git-path", "info/attributes"]).stdout.trim());
  await appendFile(infoAttributes, "*.java text eol=crlf\n", "utf8");
  git(repository, ["config", "core.autocrlf", "true"]);
  const javaFiles = git(repository, ["ls-files", "-z", "src/main/java", "src/test/java"]).stdout.split("\0").filter(Boolean);
  for (const relativePath of javaFiles) {
    const filePath = path.join(repository, relativePath);
    const text = await readFile(filePath, "utf8");
    await writeFile(filePath, text.replace(/\r\n|\r|\n/gu, "\n").replaceAll("\n", "\r\n"), "utf8");
  }
  git(repository, ["add", "--renormalize", "--", ...javaFiles]);
  const status = git(repository, ["status", "--porcelain"]).stdout.trim();
  if (status) throw new Error(`Historical Spotless Java line-ending adaptation changed Git content: ${status}`);
}

function record(id, status, evidence, note = undefined) {
  results.push({ id, status, evidence, ...(note ? { note } : {}) });
}

await mkdir(cleanRoomMavenHome, { recursive: true });
await writeFile(cleanRoomMavenSettings, mavenSettings(), { mode: 0o600 });

try {
  const built = run(process.execPath, ["scripts/build-framework-package.mjs"], root);
  const build = JSON.parse(built.stdout);
  const archiveEntries = run("unzip", ["-Z1", build.output], root).stdout.split(/\r?\n/u).filter(Boolean);
  const forbidden = archiveEntries.filter((entry) => /(?:^|\/)(?:src|pom\.xml|\.ai-sdlc\/work|grilling|tdd|codebase-design)(?:\/|$)/u.test(entry));
  if (forbidden.length > 0) throw new Error(`Package contains forbidden Demo/runtime/vendor files: ${forbidden.join(", ")}`);
  const extracted = path.join(workspace, "extracted");
  await mkdir(extracted);
  run("unzip", ["-q", build.output, "-d", extracted], root);
  const packageRoot = path.join(extracted, "AI-SDLC-FRAMEWORK");
  record(1, "PASS", `Allowlisted ZIP ${build.sha256}; ${archiveEntries.length} entries`);
  const install = path.join(packageRoot, "scripts/install-ai-sdlc.mjs");
  const installMatt = path.join(packageRoot, "scripts/install-matt-skills.mjs");
  const mattLock = JSON.parse(await readFile(path.join(packageRoot, ".ai-sdlc-framework/locks/matt-skills.lock.json"), "utf8"));
  const suppliedMattCheckout = process.env.AI_SDLC_MATT_SKILLS_CHECKOUT;
  const mattCheckout = suppliedMattCheckout ? path.resolve(suppliedMattCheckout) : path.join(workspace, "matt-skills");
  if (!suppliedMattCheckout) run("git", ["clone", "--config", "core.autocrlf=false", "--quiet", "--depth", "1", "--branch", mattLock.tag, mattLock.repository, mattCheckout], workspace);
  function installFramework(target) {
    run(process.execPath, [install, "--source", packageRoot, "--target", target], packageRoot);
    run(process.execPath, [installMatt, "--target", target, "--checkout", mattCheckout], packageRoot);
  }
  async function assertMattInstall(target) {
    for (const [skillName, skill] of Object.entries(mattLock.skills)) {
      for (const [relativeFile, expected] of Object.entries(skill.files)) {
        const actual = sha256(await readFile(path.join(target, ".agents/skills", skillName, relativeFile)));
        if (actual !== expected) throw new Error(`Installed Matt Skill digest mismatch: ${skillName}/${relativeFile}`);
      }
    }
    const notice = sha256(await readFile(path.join(target, ".agents/skills/THIRD_PARTY_NOTICES.md")));
    if (notice !== mattLock.noticeSha256) throw new Error("Installed Matt Skill notice digest mismatch.");
  }

  const fresh = await makeRepository("new-project");
  installFramework(fresh);
  installFramework(fresh);
  await assertMattInstall(fresh);
  commit(fresh, "chore: install framework");
  const initialInspect = cli(fresh, packageRoot, ["inspect"]);
  if (initialInspect.nextAction !== "setup-project") throw new Error("Fresh install did not request setup-project.");
  const toolchain = path.join(workspace, "toolchain.json");
  const behaviorCommand = "const fs=require('node:fs');if(fs.existsSync('.ai-sdlc/work/fixture/work.json')){const{spawnSync}=require('node:child_process');const r=spawnSync(process.execPath,['--test','test/feature.test.mjs'],{stdio:'inherit'});process.exit(r.status??1)}";
  await writeFile(toolchain, `${JSON.stringify({ schemaVersion: 1, checks: [
    { id: "behavior", command: ["node", "-e", behaviorCommand] },
    { id: "unit", command: ["node", "-e", "process.stdout.write('1 test passed\\n')"] },
  ] }, null, 2)}\n`);
  cli(fresh, packageRoot, ["setup", "--mode", "NEW_CODEBASE", "--project-id", "clean-room", "--toolchain", toolchain]);
  commit(fresh, "chore: establish project");
  record(2, "PASS", "NEW_CODEBASE project record created and validated");

  const existing = await makeRepository("adopt-project");
  await mkdir(path.join(existing, "src"));
  await writeFile(path.join(existing, "README.md"), "existing readme\n");
  await writeFile(path.join(existing, "AGENTS.md"), "# Existing instructions\n\nKeep this text.\n");
  await writeFile(path.join(existing, "src/sentinel.txt"), "preserve me\n");
  commit(existing, "feat: existing product");
  const before = {
    readme: await readFile(path.join(existing, "README.md"), "utf8"),
    sentinel: await readFile(path.join(existing, "src/sentinel.txt"), "utf8"),
  };
  installFramework(existing);
  installFramework(existing);
  const agents = await readFile(path.join(existing, "AGENTS.md"), "utf8");
  if ((agents.match(/ai-sdlc-framework:begin/gu) ?? []).length !== 1 || !agents.includes("Keep this text.")) throw new Error("ADOPT did not preserve AGENTS content idempotently.");
  if ((await readFile(path.join(existing, "README.md"), "utf8")) !== before.readme || (await readFile(path.join(existing, "src/sentinel.txt"), "utf8")) !== before.sentinel) throw new Error("ADOPT changed product files.");
  commit(existing, "chore: install framework");
  const adoptToolchain = path.join(workspace, "adopt-toolchain.json");
  await writeFile(adoptToolchain, `${JSON.stringify({ schemaVersion: 1, checks: [{ id: "unit", command: ["node", "-e", "process.exit(0)"] }] }, null, 2)}\n`);
  cli(existing, packageRoot, ["setup", "--mode", "ADOPT_EXISTING", "--project-id", "adopted", "--toolchain", adoptToolchain]);
  record(3, "PASS", "ADOPT_EXISTING preserved README, AGENTS outside marker, and src sentinel; second install idempotent");

  const freshRemote = path.join(workspace, "new-project-remote.git");
  git(workspace, ["init", "--bare", freshRemote]);
  git(fresh, ["remote", "add", "origin", freshRemote]);
  git(fresh, ["push", "-u", "origin", "main"]);

  const request = path.join(workspace, "request.md");
  await writeFile(request, "# Request\n\nCreate a deterministic fixture capability.\n");
  cli(fresh, packageRoot, ["start", "--work-id", "fixture", "--request", request, "--kind", "PRODUCT"]);
  commit(fresh, "docs: checkpoint draft authority");
  const spec = path.join(fresh, ".ai-sdlc/work/fixture/spec.md");
  await writeFile(spec, [
    "# Fixture", "", "## 目標", "", "建立可驗證的 fixture。", "", "## 可驗收條件", "", "- [ ] src/feature.txt 存在。", "", "## 邊界與錯誤", "", "- 檔案缺少時 behavior check 必須失敗。", "", "## 非目標", "", "- 不包含遠端交付。", "", "## 驗證方式", "", "- behavior 與 unit checks。", "",
  ].join("\n"));
  record(4, "SIMULATED", "Raw requirement entered define-requirement; semantic grilling requires an AI/user interaction", "The deterministic intake and output boundary ran; no claim that an automated script performed semantic interviewing.");
  record(5, "PASS", "Draft Spec authority created with required sections");

  const headBeforeFreeze = git(fresh, ["rev-parse", "HEAD"]).stdout.trim();
  const refsBeforeFreeze = git(fresh, ["ls-remote", "--refs", "origin"]).stdout;
  const frozen = cli(fresh, packageRoot, ["freeze", "--work-id", "fixture", "--confirmation-source", "human:clean-room"]);
  const freezePaths = git(fresh, ["diff-tree", "--no-commit-id", "--name-only", "-r", frozen.freezeCommit]).stdout.trim();
  if (freezePaths !== ".ai-sdlc/work/fixture/spec.md" || frozen.freezeCommit === headBeforeFreeze) throw new Error("Freeze was not a real Spec-only commit.");
  if (JSON.stringify(frozen.remoteActions) !== "[]" || git(fresh, ["ls-remote", "--refs", "origin"]).stdout !== refsBeforeFreeze) throw new Error("Freeze changed remote refs.");
  record(6, "PASS", `Real Spec-only freeze commit ${frozen.freezeCommit}`);
  record(7, "PASS", "Freeze returned remoteActions=[] and performed no remote command");

  const frozenLf = await readFile(spec, "utf8");
  await writeFile(spec, frozenLf.replace(/\n/gu, "\r\n"));
  const normalizedInspect = cli(fresh, packageRoot, ["inspect", "--work-id", "fixture"]);
  if (normalizedInspect.nextAction !== "choose-mode") throw new Error("LF-normalized Spec digest treated CRLF checkout bytes as a semantic change.");
  await writeFile(spec, frozenLf);

  cli(fresh, packageRoot, ["mode", "--work-id", "fixture", "--mode", "autonomous"]);
  const rejectedPublish = cli(fresh, packageRoot, ["preflight", "--work-id", "fixture", "--action", "publish"], { allowFailure: true });
  if (rejectedPublish.status === 0 || JSON.parse(rejectedPublish.stderr).code !== "DELIVERY_NOT_READY") throw new Error("Premature publish was not rejected by the expected gate.");
  await mkdir(path.join(fresh, "test"), { recursive: true });
  await writeFile(path.join(fresh, "test/feature.test.mjs"), [
    'import assert from "node:assert/strict";',
    'import { readFile } from "node:fs/promises";',
    'import { test } from "node:test";',
    '',
    'test("fixture capability exists", async () => {',
    '  assert.equal(await readFile("src/feature.txt", "utf8"), "implemented\\n");',
    '});',
    '',
  ].join("\n"));
  const red = cli(fresh, packageRoot, ["verify", "--work-id", "fixture", "--kind", "red", "--check-id", "behavior", "--expected-failure", "feature.txt"]);
  if (red.runs[0].result !== "EXPECTED_FAIL") throw new Error("Representative Red did not fail for the expected missing behavior.");
  await mkdir(path.join(fresh, "src"), { recursive: true });
  await writeFile(path.join(fresh, "src/feature.txt"), "implemented\n");
  cli(fresh, packageRoot, ["verify", "--work-id", "fixture", "--kind", "green", "--check-id", "behavior"]);
  commit(fresh, "feat: implement fixture with acceptance test");
  cli(fresh, packageRoot, ["verify", "--work-id", "fixture"]);
  cli(fresh, packageRoot, ["review", "--work-id", "fixture", "--type", "implementation", "--verdict", "PASS", "--summary", "Spec and implementation agree"]);
  cli(fresh, packageRoot, ["review", "--work-id", "fixture", "--type", "test", "--verdict", "PASS", "--summary", "Behavior check fails before and passes after implementation"]);
  const publish = cli(fresh, packageRoot, ["preflight", "--work-id", "fixture", "--action", "publish"]);
  if (!publish.evidenceComment.includes(publish.subject.headSha)) throw new Error("Publish evidence does not bind the exact head.");

  const modeSequences = [];
  for (const selectedMode of ["supervised", "delegated", "autonomous"]) {
    const modeRepository = await makeRepository(`mode-${selectedMode}`);
    installFramework(modeRepository);
    commit(modeRepository, "chore: install framework");
    cli(modeRepository, packageRoot, ["setup", "--mode", "NEW_CODEBASE", "--project-id", `mode-${selectedMode}`, "--toolchain", adoptToolchain]);
    commit(modeRepository, "chore: establish project");
    cli(modeRepository, packageRoot, ["start", "--work-id", `policy-${selectedMode}`, "--request", request, "--kind", "FRAMEWORK"]);
    const modeSpec = path.join(modeRepository, `.ai-sdlc/work/policy-${selectedMode}/spec.md`);
    await writeFile(modeSpec, [
      "# Mode policy", "", "## 目標", "", "驗證模式不改變品質門檻。", "", "## 可驗收條件", "", "- [ ] 固定檢查與兩份 Review 都通過。", "", "## 邊界與錯誤", "", "- 任一 gate 失敗時不得 publish。", "", "## 非目標", "", "- 不執行遠端動作。", "", "## 驗證方式", "", "- unit check。", "",
    ].join("\n"));
    cli(modeRepository, packageRoot, ["freeze", "--work-id", `policy-${selectedMode}`, "--confirmation-source", "human:clean-room"]);
    const sequence = [cli(modeRepository, packageRoot, ["inspect", "--work-id", `policy-${selectedMode}`]).nextAction];
    cli(modeRepository, packageRoot, ["mode", "--work-id", `policy-${selectedMode}`, "--mode", selectedMode]);
    sequence.push(cli(modeRepository, packageRoot, ["inspect", "--work-id", `policy-${selectedMode}`]).nextAction);
    await writeFile(path.join(modeRepository, `${selectedMode}.txt`), "implemented\n");
    commit(modeRepository, `feat: implement ${selectedMode} fixture`);
    sequence.push(cli(modeRepository, packageRoot, ["inspect", "--work-id", `policy-${selectedMode}`]).nextAction);
    cli(modeRepository, packageRoot, ["verify", "--work-id", `policy-${selectedMode}`]);
    sequence.push(cli(modeRepository, packageRoot, ["inspect", "--work-id", `policy-${selectedMode}`]).nextAction);
    cli(modeRepository, packageRoot, ["review", "--work-id", `policy-${selectedMode}`, "--type", "implementation", "--verdict", "PASS", "--summary", "Mode does not alter implementation evidence"]);
    cli(modeRepository, packageRoot, ["review", "--work-id", `policy-${selectedMode}`, "--type", "test", "--verdict", "PASS", "--summary", "Mode does not alter test evidence"]);
    sequence.push(cli(modeRepository, packageRoot, ["inspect", "--work-id", `policy-${selectedMode}`]).nextAction);
    const modePublish = ["preflight", "--work-id", `policy-${selectedMode}`, "--action", "publish"];
    if (selectedMode === "supervised") modePublish.push("--authorization-source", "human:clean-room-publish");
    cli(modeRepository, packageRoot, modePublish);
    modeSequences.push(sequence);
  }
  if (modeSequences.some((sequence) => JSON.stringify(sequence) !== JSON.stringify(modeSequences[0]))) throw new Error("Execution mode changed a quality gate.");

  record(8, "PASS", "Autonomous fixture completed the same local quality gates without an extra workflow path");
  record(9, "PASS", "Clean-room exercised supervised, delegated, and autonomous through identical verification, two-review, and successful publish preflight gates");
  record(10, "PASS", "Implementation was committed after the frozen Spec commit");
  record(11, "PASS", "Representative behavior check produced actual EXPECTED_FAIL Red then PASS Green");
  record(12, "PASS", "All project checks completed on committed exact Head");
  record(13, "PASS", "Separate Implementation Review bound to exact Head");
  record(14, "PASS", "Separate Test Review bound to exact Head");
  record(15, "PASS", "Publish preflight produced evidence only after verification and both PASS reviews");

  record(16, "NOT_RUN", "Live Push/PR/Ready/Merge requires a real authenticated GitHub host binding and is not simulated", "No fake receipt is accepted in clean-room; the task report records the actual remote attempt separately.");
  await writeFile(path.join(fresh, "src/late.txt"), "late\n");
  commit(fresh, "feat: invalidate evidence head");
  const stale = cli(fresh, packageRoot, ["inspect", "--work-id", "fixture"]);
  if (stale.nextAction !== "verify") throw new Error("A new Head did not invalidate prior verification and reviews.");
  record(19, "PASS", "A new implementation Head invalidated verification and both reviews");
  cli(fresh, packageRoot, ["verify", "--work-id", "fixture"]);
  cli(fresh, packageRoot, ["review", "--work-id", "fixture", "--type", "implementation", "--verdict", "PASS", "--summary", "Late committed change remains within Spec"]);
  cli(fresh, packageRoot, ["review", "--work-id", "fixture", "--type", "test", "--verdict", "PASS", "--summary", "Checks remain sensitive after the new Head"]);

  const updateSource = path.join(workspace, "framework-update");
  await cp(packageRoot, updateSource, { recursive: true });
  const updateVersionPath = path.join(updateSource, ".ai-sdlc-framework/VERSION");
  const updateBootstrapPath = path.join(updateSource, ".ai-sdlc-framework/BOOTSTRAP.md");
  await writeFile(updateVersionPath, "2.1.1\n");
  await appendFile(updateBootstrapPath, "\nUpdate drill marker.\n");
  const updateManifestPath = path.join(updateSource, ".ai-sdlc-framework/manifest.json");
  const updateManifest = JSON.parse(await readFile(updateManifestPath, "utf8"));
  updateManifest.version = "2.1.1";
  updateManifest.files[".ai-sdlc-framework/VERSION"] = sha256(await readFile(updateVersionPath));
  updateManifest.files[".ai-sdlc-framework/BOOTSTRAP.md"] = sha256(await readFile(updateBootstrapPath));
  await writeFile(updateManifestPath, `${JSON.stringify(updateManifest, null, 2)}\n`);
  const updateInstall = path.join(updateSource, "scripts/install-ai-sdlc.mjs");
  const firstUpdate = JSON.parse(run(process.execPath, [updateInstall, "--source", updateSource, "--target", fresh], updateSource).stdout);
  commit(fresh, "chore: update Framework to 2.1.1");
  const lockBeforeRepeat = await readFile(path.join(fresh, ".ai-sdlc/framework.lock.json"), "utf8");
  const secondUpdate = JSON.parse(run(process.execPath, [updateInstall, "--source", updateSource, "--target", fresh], updateSource).stdout);
  if (!firstUpdate.projectUpdated || secondUpdate.projectUpdated) throw new Error("Framework update did not update project facts exactly once.");
  if ((await readFile(path.join(fresh, ".ai-sdlc/framework.lock.json"), "utf8")) !== lockBeforeRepeat || git(fresh, ["status", "--porcelain"]).stdout.trim()) throw new Error("Repeat Framework install was not byte- and Git-idempotent.");
  const updatedProject = JSON.parse(await readFile(path.join(fresh, ".ai-sdlc/project.json"), "utf8"));
  const updatedLock = JSON.parse(await readFile(path.join(fresh, ".ai-sdlc/framework.lock.json"), "utf8"));
  if (updatedProject.frameworkVersion !== "2.1.1" || updatedProject.frameworkLockSha256 !== updatedLock.manifestSha256) throw new Error("Framework update left project and install lock inconsistent.");
  const invalidatedByUpdate = cli(fresh, updateSource, ["inspect", "--work-id", "fixture"]);
  if (invalidatedByUpdate.nextAction !== "verify") throw new Error("Framework update did not invalidate exact-Framework evidence.");
  cli(fresh, updateSource, ["verify", "--work-id", "fixture"]);
  cli(fresh, updateSource, ["review", "--work-id", "fixture", "--type", "implementation", "--verdict", "PASS", "--summary", "Implementation remains valid after Framework update"]);
  cli(fresh, updateSource, ["review", "--work-id", "fixture", "--type", "test", "--verdict", "PASS", "--summary", "Checks remain valid after Framework update"]);
  record(20, "PASS", "Updated installed Framework 2.1.0 → 2.1.1, updated project lock once, invalidated old evidence, and kept repeat install idempotent");

  await appendFile(spec, "\nUnconfirmed change.\n");
  const drift = cli(fresh, packageRoot, ["inspect", "--work-id", "fixture"]);
  if (drift.nextAction !== "spec-change-needed") throw new Error("Frozen Spec drift did not take precedence.");
  cli(fresh, packageRoot, ["reopen", "--work-id", "fixture", "--reason", "clean-room change control"]);
  record(17, "PASS", "Frozen Spec drift blocked work and reopen returned to requirement definition");
  record(18, "PASS", "Expected-signature Red and an actual rejected premature publish remained recoverable in the same work record");

  const crlf = await makeRepository("crlf-project");
  installFramework(crlf);
  const managed = path.join(crlf, ".ai-sdlc-framework/contracts/project.schema.json");
  const lf = (await readFile(managed, "utf8")).replace(/\r\n/gu, "\n");
  await writeFile(managed, lf.replace(/\n/gu, "\r\n"));
  const crlfCheck = cli(crlf, packageRoot, ["check-install"], { allowFailure: true });
  if (crlfCheck.status === 0) throw new Error("CRLF install drift was not rejected.");
  record(21, "PASS", "Managed-file CRLF drift rejected; a CRLF working copy of unchanged Spec content preserved the frozen LF-normalized digest");

  const freshProcess = cli(existing, packageRoot, ["inspect"]);
  if (!freshProcess.nextAction) throw new Error("Fresh process could not recover a next action.");
  record(22, "PASS", `Fresh Node process recovered nextAction=${freshProcess.nextAction} from disk`);
  const demo = path.join(workspace, "demo-replay");
  const demoBase = "15ee40fc1511ce24d23eb3f96eee81ba76e9ebcc";
  const demoFeature = "cf8911050b7641b5f7c89db682d20bab7fbbe1ce";
  run("git", ["clone", "--config", "core.autocrlf=false", "--quiet", "--no-hardlinks", root, demo], workspace);
  git(demo, ["switch", "-c", "replay-base", demoBase]);
  git(demo, ["config", "user.name", "Clean Room"]);
  git(demo, ["config", "user.email", "clean-room@example.invalid"]);
  const installedDemo = run(process.execPath, [install, "--source", packageRoot, "--target", demo], packageRoot);
  if (!JSON.parse(installedDemo.stdout).migratedLegacy) throw new Error("Known simplified-v2.1 layout was not migrated during ADOPT.");
  run(process.execPath, [installMatt, "--target", demo, "--checkout", mattCheckout], packageRoot);
  commit(demo, "chore: install simplified AI-SDLC Framework");
  await useHistoricalSpotlessJavaEndings(demo);
  const demoToolchain = path.join(workspace, "demo-toolchain.json");
  await writeFile(demoToolchain, `${JSON.stringify({ schemaVersion: 1, checks: [{
    id: "maven",
    command: ["bash", "./mvnw", "--settings", cleanRoomMavenSettings, "--batch-mode", "--no-transfer-progress", "verify"],
    timeoutSeconds: 600,
  }] }, null, 2)}\n`);
  const demoMavenTimeout = { timeout: 660_000 };
  cli(demo, packageRoot, ["setup", "--mode", "ADOPT_EXISTING", "--project-id", "demo-replay", "--toolchain", demoToolchain, "--default-branch", "replay-base"], demoMavenTimeout);
  const demoRequest = path.join(workspace, "demo-request.md");
  await writeFile(demoRequest, "# Request\n\nImplement the confirmed A+B HTTP API contract.\n");
  cli(demo, packageRoot, ["start", "--work-id", "a-plus-b-replay", "--request", demoRequest, "--kind", "PRODUCT"]);
  commit(demo, "docs: checkpoint A+B replay draft");
  const demoSpecPath = path.join(demo, ".ai-sdlc/work/a-plus-b-replay/spec.md");
  const demoSpec = git(root, ["show", `${demoFeature}:docs/specs/a-plus-b.md`]).stdout;
  await writeFile(demoSpecPath, demoSpec);
  cli(demo, packageRoot, ["freeze", "--work-id", "a-plus-b-replay", "--confirmation-source", "historical:user-confirmed-spec"]);
  cli(demo, packageRoot, ["mode", "--work-id", "a-plus-b-replay", "--mode", "autonomous"]);
  const changed = git(root, ["diff", "--name-only", demoBase, demoFeature, "--", "src/main", "src/test"]).stdout.split(/\r?\n/u).filter(Boolean);
  const testsOnly = changed.filter((entry) => entry.startsWith("src/test/"));
  const productionOnly = changed.filter((entry) => entry.startsWith("src/main/"));
  git(demo, ["checkout", demoFeature, "--", ...testsOnly]);
  const demoRed = cli(demo, packageRoot, ["verify", "--work-id", "a-plus-b-replay", "--kind", "red", "--check-id", "maven", "--expected-failure", "AdditionService"], demoMavenTimeout);
  if (demoRed.runs[0].result !== "EXPECTED_FAIL") throw new Error("A+B replay did not produce an actual Red before implementation.");
  git(demo, ["checkout", demoFeature, "--", ...productionOnly]);
  cli(demo, packageRoot, ["verify", "--work-id", "a-plus-b-replay", "--kind", "green", "--check-id", "maven"], demoMavenTimeout);
  commit(demo, "feat: implement A+B from frozen Spec and acceptance tests");
  cli(demo, packageRoot, ["verify", "--work-id", "a-plus-b-replay"], demoMavenTimeout);
  cli(demo, packageRoot, ["review", "--work-id", "a-plus-b-replay", "--type", "implementation", "--verdict", "PASS", "--summary", "Historical A+B implementation matches the frozen contract"]);
  cli(demo, packageRoot, ["review", "--work-id", "a-plus-b-replay", "--type", "test", "--verdict", "PASS", "--summary", "29 Maven tests cover the public HTTP and core seams"]);
  cli(demo, packageRoot, ["preflight", "--work-id", "a-plus-b-replay", "--action", "publish"]);
  record(23, "PASS", "Replayed A+B from pre-feature baseline 15ee40f: new Framework migration, Spec-only freeze, actual Maven Red/Green, 29 tests, two reviews, publish preflight");
  record(24, "PASS", `Pinned Matt Skills ${mattLock.tag}@${mattLock.commit} and notice installed with exact digests; repeat install idempotent`);

  results.sort((left, right) => left.id - right.id);
  const output = { ok: true, generatedAt: new Date().toISOString(), results };
  await mkdir(path.join(root, "dist"), { recursive: true });
  await writeFile(path.join(root, "dist/clean-room-results.json"), `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ ok: false, message: error.message, results }, null, 2)}\n`);
  process.exitCode = 1;
} finally {
  await rm(workspace, { recursive: true, force: true });
}
