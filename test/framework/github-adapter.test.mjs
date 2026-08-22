import assert from "node:assert/strict";
import { test } from "node:test";

import { inspectDelivery as inspectEngineDelivery, mergePreflight, mergeWhenReady as mergeEngineWhenReady } from "../../.ai-sdlc-framework/lib/engine.mjs";
import { assertMergeable, createGitHubAdapter, renderEvidenceComment } from "../../.ai-sdlc-framework/lib/github-adapter.mjs";
import {
  createRepository,
  freezeDraft,
  implementChange,
  initialiseProject,
  newDraft,
  recordReview,
  setMode,
  git,
  verify,
} from "./helpers.mjs";

const HEAD = "a".repeat(40);
const BASE = "b".repeat(40);
const MERGE = "c".repeat(40);
const TEST_MERGE = "d".repeat(40);

function notFound() {
  return Object.assign(new Error("Not Found"), { status: 404 });
}

function defaultPull(overrides = {}) {
  return {
    number: 7,
    node_id: "PR_node_7",
    state: "open",
    draft: true,
    mergeable: true,
    head: { sha: HEAD, ref: "work/change" },
    base: { sha: BASE, ref: "main" },
    merged_at: null,
    merge_commit_sha: null,
    html_url: "https://example.invalid/pull/7",
    ...overrides,
  };
}

function fakeGitHubApi(state, calls = []) {
  const page = (values, number) => values.slice((number - 1) * 100, number * 100);
  return {
    rest: {
      git: {
        async getRef(input) {
          calls.push(["git.getRef", input]);
          const sha = input.ref === "heads/main" ? state.remoteBaseSha : state.branchSha;
          if (sha === null) throw notFound();
          return { data: { object: { sha } } };
        },
      },
      pulls: {
        async list(input) {
          calls.push(["pulls.list", input]);
          return { data: state.pullRequest === null ? [] : [state.pullRequest] };
        },
        async create(input) {
          calls.push(["pulls.create", input]);
          state.pullRequest = defaultPull({
            draft: input.draft,
            head: { sha: state.branchSha, ref: input.head },
            base: { sha: state.baseSha ?? BASE, ref: input.base },
            title: input.title,
            body: input.body,
          });
          return { data: state.pullRequest };
        },
        async get(input) {
          calls.push(["pulls.get", input]);
          return { data: state.pullRequest };
        },
        async merge(input) {
          calls.push(["pulls.merge", input]);
          state.pullRequest = {
            ...state.pullRequest,
            state: "closed",
            draft: false,
            merged_at: "2026-08-22T00:00:00Z",
            merge_commit_sha: MERGE,
          };
          return { data: { merged: true, sha: MERGE, message: "merged" } };
        },
      },
      checks: {
        async listForRef(input) {
          calls.push(["checks.listForRef", input]);
          const values = state.checkRunsByRef?.[input.ref] ?? state.checkRuns;
          return { data: { check_runs: page(values, input.page) } };
        },
      },
      issues: {
        async listComments(input) {
          calls.push(["issues.listComments", input]);
          return { data: page(state.comments, input.page) };
        },
        async createComment(input) {
          calls.push(["issues.createComment", input]);
          const comment = { id: 91, html_url: "https://example.invalid/comment/91", user: { login: state.createdCommentAuthor }, body: input.body };
          state.comments.push(comment);
          return { data: comment };
        },
      },
      repos: {
        async getBranchProtection(input) {
          calls.push(["repos.getBranchProtection", input]);
          if (state.protection === null) throw notFound();
          return { data: state.protection };
        },
        async getBranchRules(input) {
          calls.push(["repos.getBranchRules", input]);
          if (state.rules === null) throw notFound();
          return { data: page(state.rules, input.page) };
        },
        async getCombinedStatusForRef(input) {
          calls.push(["repos.getCombinedStatusForRef", input]);
          const values = state.statusesByRef?.[input.ref] ?? state.statuses;
          return { data: { statuses: page(values, input.page) } };
        },
      },
    },
    async graphql(query, variables) {
      const mutation = query.includes("convertPullRequestToDraft") ? "graphql.draft" : "graphql.ready";
      calls.push([query.startsWith("mutation") ? mutation : "graphql.threads", variables]);
      if (query.startsWith("mutation")) {
        if (query.includes("convertPullRequestToDraft")) {
          state.pullRequest.draft = true;
          return { convertPullRequestToDraft: { pullRequest: { isDraft: true } } };
        }
        state.pullRequest.draft = false;
        return { markPullRequestReadyForReview: { pullRequest: { isDraft: false } } };
      }
      const offset = variables.cursor === null ? 0 : Number(variables.cursor);
      const nodes = state.threads.slice(offset, offset + 100);
      const next = offset + nodes.length;
      return {
        repository: {
          pullRequest: {
            reviewDecision: state.reviewDecision,
            reviewThreads: {
              nodes,
              pageInfo: { hasNextPage: next < state.threads.length, endCursor: next < state.threads.length ? String(next) : null },
            },
          },
        },
      };
    },
  };
}

function makeState(overrides = {}) {
  return {
    branchSha: HEAD,
    remoteBaseSha: BASE,
    baseSha: BASE,
    pullRequest: defaultPull(),
    checkRuns: [],
    statuses: [],
    comments: [],
    threads: [],
    reviewDecision: null,
    protection: { required_status_checks: null },
    rules: [],
    createdCommentAuthor: "framework-bot",
    ...overrides,
  };
}

function adapterFor(state, calls = []) {
  return createGitHubAdapter({
    api: fakeGitHubApi(state, calls),
    owner: "example",
    repo: "project",
    evidenceAuthor: "framework-bot",
  });
}

test("delivery facts are queried live in branch, PR, optional CI, and merge order", async () => {
  const state = makeState({ branchSha: null, pullRequest: null });
  const calls = [];
  const adapter = adapterFor(state, calls);

  assert.deepEqual(await adapter.inspectDelivery({ branch: "work/change", headSha: HEAD }), {
    pushed: false,
    pullRequest: null,
    ciPassed: false,
    merged: false,
    mergeSha: null,
  });

  state.branchSha = HEAD;
  let facts = await adapter.inspectDelivery({ branch: "work/change", headSha: HEAD });
  assert.equal(facts.pushed, true);
  assert.equal(facts.pullRequest, null);

  state.pullRequest = defaultPull();
  state.checkRuns = [{ name: "advisory", status: "in_progress", conclusion: null }];
  facts = await adapter.inspectDelivery({ branch: "work/change", headSha: HEAD });
  assert.equal(facts.pullRequest.draft, true);
  assert.equal(facts.ciPassed, false);

  state.checkRuns = [{ name: "advisory", status: "completed", conclusion: "success" }];
  facts = await adapter.inspectDelivery({ branch: "work/change", headSha: HEAD });
  assert.equal(facts.ciPassed, true);

  state.pullRequest = defaultPull({ state: "closed", draft: false, merged_at: "2026-08-22T00:00:00Z", merge_commit_sha: MERGE });
  facts = await adapter.inspectDelivery({ branch: "work/change", headSha: HEAD });
  assert.equal(facts.merged, true);
  assert.equal(facts.mergeSha, MERGE);
  assert.ok(calls.some(([name]) => name === "checks.listForRef"));

  state.branchSha = null;
  facts = await adapter.inspectDelivery({ branch: "work/change", headSha: HEAD });
  assert.equal(facts.merged, true, "a deleted merged branch must not erase the exact PR result");
  state.pullRequest = defaultPull();
  state.branchSha = "d".repeat(40);
  await assert.rejects(adapter.inspectDelivery({ branch: "work/change", headSha: HEAD }), /Head SHA mismatch/);
});

test("publish actions bind the Draft PR, exact base, evidence author/body, and Ready transition", async () => {
  const state = makeState({ pullRequest: null });
  const calls = [];
  const adapter = adapterFor(state, calls);

  const opened = await adapter.openPullRequest({
    branch: "work/change",
    baseBranch: "main",
    headSha: HEAD,
    title: "Change",
    body: "Description",
    draft: false,
  });
  assert.equal(opened.draft, true);
  assert.ok(calls.some(([name, input]) => name === "pulls.create" && input.draft === true && input.base === "main"));

  const body = `<!-- ai-sdlc-evidence:${HEAD} -->\nexact evidence`;
  const comment = await adapter.appendEvidence({ pullRequest: 7, branch: "work/change", baseBranch: "main", headSha: HEAD, body });
  assert.equal(comment.headSha, HEAD);
  assert.equal(state.comments.at(-1).body, body);

  const ready = await adapter.markReadyForReview({ pullRequest: 7, branch: "work/change", baseBranch: "main", headSha: HEAD, body });
  assert.equal(ready.ready, true);
  assert.equal(state.pullRequest.draft, false);
  assert.ok(calls.some(([name]) => name === "graphql.ready"));
  const replayedComment = await adapter.appendEvidence({ pullRequest: 7, branch: "work/change", baseBranch: "main", headSha: HEAD, body });
  assert.equal(replayedComment.idempotent, true, "Ready recovery must accept the exact comment that already exists");

  const nextHead = "e".repeat(40);
  state.branchSha = nextHead;
  state.pullRequest.head = { sha: nextHead, ref: "work/change" };
  const draft = await adapter.markDraftForUpdate({ pullRequest: 7, branch: "work/change", baseBranch: "main", headSha: nextHead });
  assert.equal(draft.draft, true);
  assert.ok(calls.some(([name]) => name === "graphql.draft"));
  const nextBody = `<!-- ai-sdlc-evidence:${nextHead} -->\nnew exact evidence`;
  await adapter.appendEvidence({ pullRequest: 7, branch: "work/change", baseBranch: "main", headSha: nextHead, body: nextBody });
  await adapter.markReadyForReview({ pullRequest: 7, branch: "work/change", baseBranch: "main", headSha: nextHead, body: nextBody });
  assert.equal(state.pullRequest.draft, false);

  state.branchSha = HEAD;
  state.pullRequest.head = { sha: HEAD, ref: "work/change" };
  state.createdCommentAuthor = "attacker";
  state.pullRequest.draft = true;
  await assert.rejects(
    adapter.appendEvidence({ pullRequest: 7, branch: "work/change", baseBranch: "main", headSha: HEAD, body: `${body}\nchanged` }),
    /configured Adapter identity/,
  );
  await assert.rejects(
    adapter.markReadyForReview({ pullRequest: 7, branch: "work/change", baseBranch: "release", headSha: HEAD, body }),
    /base branch/,
  );
  state.pullRequest.base.ref = "main";
  state.pullRequest.draft = false;
  await assert.rejects(
    adapter.appendEvidence({ pullRequest: 7, branch: "work/change", baseBranch: "main", headSha: HEAD, body: `${body}\nnot-recorded` }),
    /Draft/,
  );
});

test("merge inspection proves ruleset/classic required checks, review facts, evidence, branches, and pagination", async () => {
  const evidence = `<!-- ai-sdlc-evidence:${HEAD} -->\nexact evidence`;
  const state = makeState({
    pullRequest: defaultPull({ draft: false }),
    checkRuns: [
      ...Array.from({ length: 100 }, (_, index) => ({ name: `advisory-${index}`, status: "completed", conclusion: "success", app: { id: 1 } })),
      { name: "build", status: "completed", conclusion: "success", app: { id: 42 } },
      { name: "security", status: "completed", conclusion: "success", app: { id: 7 } },
    ],
    statuses: [{ context: "legacy", state: "success" }],
    protection: { required_status_checks: { contexts: ["legacy"], checks: [{ context: "build", app_id: 42 }] } },
    rules: [
      ...Array.from({ length: 100 }, () => ({ type: "deletion" })),
      { type: "required_status_checks", parameters: { required_status_checks: [{ context: "security", integration_id: 7 }] } },
    ],
    threads: Array.from({ length: 101 }, () => ({ isResolved: true })),
    comments: [
      ...Array.from({ length: 100 }, (_, index) => ({ id: index, user: { login: "someone" }, body: "history" })),
      { id: 101, user: { login: "framework-bot" }, body: evidence },
    ],
    reviewDecision: "APPROVED",
  });
  const calls = [];
  const adapter = adapterFor(state, calls);
  const input = { pullRequest: 7, branch: "work/change", baseBranch: "main", headSha: HEAD, baseSha: BASE, evidenceComment: evidence };

  const snapshot = await adapter.inspectMerge(input);
  assert.deepEqual(snapshot.checks, [
    { name: "build", required: true, status: "PASS" },
    { name: "legacy", required: true, status: "PASS" },
    { name: "security", required: true, status: "PASS" },
  ]);
  assert.equal(snapshot.unresolvedThreads, 0);
  assert.equal(snapshot.blockingReviews, 0);
  assert.equal(snapshot.evidenceHeadSha, HEAD);
  assert.doesNotThrow(() => assertMergeable(snapshot));
  assert.ok(calls.some(([name, request]) => name === "checks.listForRef" && request.page === 2));
  assert.ok(calls.some(([name, request]) => name === "issues.listComments" && request.page === 2));
  assert.ok(calls.some(([name, request]) => name === "repos.getBranchRules" && request.page === 2));
  assert.ok(calls.filter(([name]) => name === "graphql.threads").length >= 2);

  state.checkRuns.at(-1).conclusion = "failure";
  await assert.rejects(adapter.mergeWhenReady(input), /Required GitHub checks/);
  state.checkRuns.at(-1).conclusion = "success";
  state.reviewDecision = "CHANGES_REQUESTED";
  await assert.rejects(adapter.mergeWhenReady(input), /changes-requested/);
  state.reviewDecision = "APPROVED";
  state.threads[0].isResolved = false;
  await assert.rejects(adapter.mergeWhenReady(input), /unresolved review threads/);
  state.threads[0].isResolved = true;
  state.pullRequest.mergeable = false;
  await assert.rejects(adapter.mergeWhenReady(input), /not mergeable/);
  state.pullRequest.mergeable = true;
  state.pullRequest.draft = true;
  await assert.rejects(adapter.mergeWhenReady(input), /Ready for Review/);
  state.pullRequest.draft = false;
  state.comments.at(-1).user.login = "attacker";
  await assert.rejects(adapter.mergeWhenReady(input), /no evidence comment/);
  state.comments.at(-1).user.login = "framework-bot";

  state.rules = [{ type: "workflows", parameters: {} }];
  await assert.rejects(adapter.mergeWhenReady(input), /not mechanically verified/);
  state.rules = [
    ...Array.from({ length: 100 }, () => ({ type: "deletion" })),
    { type: "required_status_checks", parameters: { required_status_checks: [{ context: "security", integration_id: 7 }] } },
  ];

  const before = calls.filter(([name]) => name === "pulls.get").length;
  const merged = await adapter.mergeWhenReady({ ...input, method: "squash" });
  assert.equal(merged.mergeSha, MERGE);
  assert.ok(calls.filter(([name]) => name === "pulls.get").length > before, "merge must perform a fresh live inspection");
  assert.ok(calls.some(([name, request]) => name === "pulls.merge" && request.sha === HEAD && request.merge_method === "squash"));
  const priorCheckRuns = state.checkRuns;
  const priorStatuses = state.statuses;
  state.checkRuns = [];
  state.statuses = [];
  const recoveredMerge = await adapter.mergeWhenReady(input);
  assert.equal(recoveredMerge.mergeSha, MERGE, "an exact merged PR must recover without reapplying pre-merge check state");
  state.comments.at(-1).user.login = "attacker";
  await assert.rejects(adapter.mergeWhenReady(input), /no exact trusted evidence comment/);
  state.comments.at(-1).user.login = "framework-bot";
  state.checkRuns = priorCheckRuns;
  state.statuses = priorStatuses;

  state.pullRequest = defaultPull({ draft: false, base: { sha: BASE, ref: "release" } });
  await assert.rejects(adapter.inspectMerge(input), /another base branch/);
  state.pullRequest = defaultPull({ draft: false, base: { sha: "e".repeat(40), ref: "main" } });
  await assert.rejects(adapter.inspectMerge(input), /base.*SHA/i);
  state.pullRequest = defaultPull({ draft: false });
  state.remoteBaseSha = "e".repeat(40);
  await assert.rejects(adapter.inspectMerge(input), /live base branch advanced/);
  state.remoteBaseSha = BASE;
  state.pullRequest = defaultPull({ draft: false, merged_at: "2026-08-22T00:00:00Z", merge_commit_sha: null });
  await assert.rejects(adapter.inspectMerge(input), /exact SHA/);
});

test("required checks prefer the pull request test-merge commit when it has that context", async () => {
  const evidence = `<!-- ai-sdlc-evidence:${HEAD} -->\nexact evidence`;
  const state = makeState({
    pullRequest: defaultPull({ draft: false, merge_commit_sha: TEST_MERGE }),
    protection: { required_status_checks: { checks: [{ context: "build", app_id: 42 }, { context: "lint", app_id: 42 }] } },
    checkRunsByRef: {
      [HEAD]: [
        { name: "build", status: "completed", conclusion: "success", app: { id: 42 } },
        { name: "lint", status: "completed", conclusion: "success", app: { id: 42 } },
      ],
      [TEST_MERGE]: [{ name: "build", status: "completed", conclusion: "failure", app: { id: 42 } }],
    },
    comments: [{ id: 1, user: { login: "framework-bot" }, body: evidence }],
  });
  const adapter = adapterFor(state);
  const input = { pullRequest: 7, branch: "work/change", baseBranch: "main", headSha: HEAD, baseSha: BASE, evidenceComment: evidence };

  let snapshot = await adapter.inspectMerge(input);
  assert.deepEqual(snapshot.checks, [
    { name: "build", required: true, status: "FAIL" },
    { name: "lint", required: true, status: "PENDING" },
  ]);
  assert.throws(() => assertMergeable(snapshot), /Required GitHub checks/);
  state.checkRunsByRef[TEST_MERGE][0].conclusion = "success";
  snapshot = await adapter.inspectMerge(input);
  assert.deepEqual(snapshot.checks, [
    { name: "build", required: true, status: "PASS" },
    { name: "lint", required: true, status: "PENDING" },
  ]);
  assert.throws(() => assertMergeable(snapshot), /Required GitHub checks/);
  state.checkRunsByRef[TEST_MERGE].push({ name: "lint", status: "completed", conclusion: "success", app: { id: 42 } });
  snapshot = await adapter.inspectMerge(input);
  assert.doesNotThrow(() => assertMergeable(snapshot));
});

test("public evidence comment omits command arguments and expected failure text", () => {
  const evidence = {
    subject: { headSha: HEAD, baseSha: BASE, freezeCommitSha: "d".repeat(40), specSha256: "e".repeat(64) },
    runs: [{ kind: "red", checkId: "unit", command: ["tool", "--token", "secret-value"], headSha: HEAD, worktreeSha256: "f".repeat(64), exitCode: 1, result: "EXPECTED_FAIL", expectedFailure: "secret-signature", outputSha256: "1".repeat(64), at: "2026-08-22T00:00:00.000Z" }],
    reviews: { implementation: null, test: null },
  };
  const body = renderEvidenceComment({ workId: "safe-comment" }, evidence);
  assert.doesNotMatch(body, /secret-value|secret-signature|--token/);
  assert.match(body, new RegExp(HEAD));
});

test("engine merge preflight injects exact feature/base facts and derives done only from live merged facts", async (t) => {
  const fixture = await createRepository();
  t.after(() => fixture.cleanup());
  git(fixture.repository, ["remote", "add", "origin", "https://github.com/example/project.git"]);
  await initialiseProject(fixture);
  const workId = "engine-delivery";
  await newDraft(fixture, workId);
  await freezeDraft(fixture, workId);
  setMode(fixture.repository, workId, "delegated");
  await implementChange(fixture, workId);
  verify(fixture.repository, workId);
  recordReview(fixture.repository, workId, "implementation");
  recordReview(fixture.repository, workId, "test");

  let merged = false;
  let reportedMergeSha = MERGE;
  const observed = [];
  const githubAdapter = {
    repository: "example/project",
    async inspectMerge(input) {
      observed.push(input);
      return {
        repository: "example/project",
        pullRequest: 12,
        url: "https://example.invalid/pull/12",
        branch: input.branch,
        baseBranch: input.baseBranch,
        headSha: input.headSha,
        baseSha: input.baseSha,
        draft: false,
        mergeable: true,
        unresolvedThreads: 0,
        blockingReviews: 0,
        checksKnown: true,
        checks: [],
        evidenceHeadSha: input.headSha,
        merged,
        mergeSha: merged ? reportedMergeSha : null,
      };
    },
    async mergeWhenReady(input) {
      observed.push({ merge: input });
      return { merged: true, mergeSha: MERGE };
    },
  };

  await assert.rejects(
    mergePreflight(fixture.repository, { workId, pullRequest: 12, githubAdapter: { ...githubAdapter, repository: "example/fork" } }),
    /canonical origin repository/,
  );

  const ready = await mergePreflight(fixture.repository, { workId, pullRequest: 12, githubAdapter });
  assert.equal(ready.action, "merge");
  assert.equal(observed.at(-1).branch, `feature/${workId}`);
  assert.equal(observed.at(-1).baseBranch, "main");

  await assert.rejects(
    mergeEngineWhenReady(fixture.repository, { workId, pullRequest: 12, githubAdapter }),
    /explicit authorization before Merge/,
  );
  const mergedResult = await mergeEngineWhenReady(fixture.repository, { workId, pullRequest: 12, githubAdapter, authorizationSource: "human:test-merge" });
  assert.equal(mergedResult.authorization.action, "merge");
  assert.equal(mergedResult.github.mergeSha, MERGE);

  const featureBranch = `feature/${workId}`;
  git(fixture.repository, ["switch", "main"]);
  git(fixture.repository, ["merge", "--no-ff", "-m", "test: simulate fetched GitHub merge", featureBranch]);
  reportedMergeSha = git(fixture.repository, ["rev-parse", "HEAD"]).stdout.trim();
  merged = true;
  const done = await inspectEngineDelivery(fixture.repository, { workId, pullRequest: 12, githubAdapter });
  assert.equal(done.nextAction, "done");
  assert.equal(done.mergeSha, reportedMergeSha);
});
