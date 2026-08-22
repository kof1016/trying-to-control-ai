import { assert, isSha } from "./utils.mjs";

const PAGE_LIMIT = 20;

function isNotFound(error) {
  return error?.status === 404 || error?.response?.status === 404;
}

function checkStatus(check) {
  if (check.status !== "completed") return "PENDING";
  if (check.conclusion === "success") return "PASS";
  if (["neutral", "skipped"].includes(check.conclusion)) return "SKIPPED";
  return "FAIL";
}

function commitStatus(status) {
  if (status.state === "success") return "PASS";
  if (status.state === "pending") return "PENDING";
  return "FAIL";
}

function requiredChecks(protection, branchRules) {
  const values = [];
  const classic = protection?.data?.required_status_checks;
  for (const context of classic?.contexts ?? []) values.push({ name: context, appId: null });
  for (const check of classic?.checks ?? []) values.push({ name: check.context, appId: check.app_id ?? null });
  for (const rule of branchRules?.data ?? []) {
    assert(["required_status_checks", "creation", "deletion"].includes(rule.type), "UNSUPPORTED_GITHUB_RULE", `GitHub branch rule ${rule.type ?? "unknown"} is not mechanically verified by this Adapter.`);
    if (rule.type !== "required_status_checks") continue;
    for (const check of rule.parameters?.required_status_checks ?? []) {
      values.push({ name: check.context, appId: check.integration_id ?? null });
    }
  }
  const unique = new Map(values.map((value) => [`${value.name}\0${value.appId ?? "*"}`, value]));
  const specificNames = new Set([...unique.values()].filter((value) => value.appId !== null).map((value) => value.name));
  return [...unique.values()]
    .filter((value) => value.appId !== null || !specificNames.has(value.name))
    .sort((left, right) => left.name.localeCompare(right.name) || String(left.appId).localeCompare(String(right.appId)));
}

async function allPages(fetchPage, label) {
  const values = [];
  for (let page = 1; page <= PAGE_LIMIT; page += 1) {
    const pageValues = await fetchPage(page);
    values.push(...pageValues);
    if (pageValues.length < 100) return values;
  }
  throw new Error(`${label} pagination exceeded the fail-closed limit.`);
}

async function allCheckRuns(api, input) {
  return allPages(async (page) => {
    const response = await api.rest.checks.listForRef({ ...input, filter: "latest", page, per_page: 100 });
    return response.data.check_runs ?? [];
  }, "GitHub check run");
}

async function allStatuses(api, input) {
  return allPages(async (page) => {
    const response = await api.rest.repos.getCombinedStatusForRef({ ...input, page, per_page: 100 });
    return response.data.statuses ?? [];
  }, "GitHub commit status");
}

async function allComments(api, input) {
  return allPages(async (page) => {
    const response = await api.rest.issues.listComments({ ...input, page, per_page: 100 });
    return response.data;
  }, "GitHub comment");
}

async function allReviewThreads(api, { owner, repo, pullRequest }) {
  const nodes = [];
  let reviewDecision = null;
  let cursor = null;
  for (let page = 1; page <= PAGE_LIMIT; page += 1) {
    const response = await api.graphql(
      "query($owner:String!,$repo:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewDecision reviewThreads(first:100,after:$cursor){nodes{isResolved} pageInfo{hasNextPage endCursor}}}}}",
      { owner, repo, number: pullRequest, cursor },
    );
    const pull = response.repository.pullRequest;
    reviewDecision = pull.reviewDecision ?? null;
    const threads = pull.reviewThreads;
    nodes.push(...threads.nodes);
    if (!threads.pageInfo.hasNextPage) return { nodes, reviewDecision };
    assert(typeof threads.pageInfo.endCursor === "string" && threads.pageInfo.endCursor.length > 0, "REVIEW_THREADS_TRUNCATED", "GitHub omitted the next review-thread cursor.");
    cursor = threads.pageInfo.endCursor;
  }
  throw new Error("GitHub review-thread pagination exceeded the fail-closed limit.");
}

function checkStates({ name, appId }, checkRuns, statuses) {
  const matchingRuns = checkRuns.filter((run) => run.name === name && (appId === null || run.app?.id === appId));
  const matchingStatuses = appId === null ? statuses.filter((status) => status.context === name) : [];
  return [...matchingRuns.map(checkStatus), ...matchingStatuses.map(commitStatus)];
}

function requiredCheckFacts(required, headCheckRuns, headStatuses, mergeCheckRuns = [], mergeStatuses = []) {
  const useMergeFacts = mergeCheckRuns.length > 0 || mergeStatuses.length > 0;
  const checkRuns = useMergeFacts ? mergeCheckRuns : headCheckRuns;
  const statuses = useMergeFacts ? mergeStatuses : headStatuses;
  return required.map(({ name, appId }) => {
    const states = checkStates({ name, appId }, checkRuns, statuses);
    const status = states.includes("FAIL") ? "FAIL"
      : states.includes("PENDING") ? "PENDING"
        : states.includes("PASS") ? "PASS"
          : states.includes("SKIPPED") ? "SKIPPED"
            : "PENDING";
    return { name, required: true, status };
  });
}

export function createGitHubAdapter({ api, owner, repo, evidenceAuthor }) {
  assert(
    api?.rest?.git && api?.rest?.pulls && api?.rest?.checks && api?.rest?.issues
      && typeof api?.rest?.repos?.getBranchProtection === "function"
      && typeof api?.rest?.repos?.getBranchRules === "function"
      && typeof api?.rest?.repos?.getCombinedStatusForRef === "function"
      && typeof api.graphql === "function",
    "INVALID_GITHUB_API",
    "GitHub adapter requires git, pulls, checks, issues, branch protection, branch rules, commit statuses, and GraphQL APIs.",
  );
  assert(typeof owner === "string" && owner.length > 0 && typeof repo === "string" && repo.length > 0, "INVALID_GITHUB_REPOSITORY", "GitHub owner and repository are required.");
  assert(typeof evidenceAuthor === "string" && evidenceAuthor.length > 0, "INVALID_GITHUB_EVIDENCE_AUTHOR", "A trusted GitHub evidence author is required.");

  async function branchSha(branch) {
    try {
      const response = await api.rest.git.getRef({ owner, repo, ref: `heads/${branch}` });
      return response.data.object.sha;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async function branchRequirements(branch) {
    let protection;
    let rules;
    try {
      protection = await api.rest.repos.getBranchProtection({ owner, repo, branch });
    } catch (error) {
      if (!isNotFound(error)) throw error;
      protection = { data: { required_status_checks: null } };
    }
    try {
      rules = { data: await allPages(async (page) => {
        const response = await api.rest.repos.getBranchRules({ owner, repo, branch, page, per_page: 100 });
        return response.data;
      }, "GitHub branch rule") };
    } catch (error) {
      if (!isNotFound(error)) throw error;
      rules = { data: [] };
    }
    return requiredChecks(protection, rules);
  }

  async function getExactPull({ pullRequest, branch, baseBranch, headSha, baseSha = undefined }) {
    const pull = (await api.rest.pulls.get({ owner, repo, pull_number: pullRequest })).data;
    assert(pull.head?.sha === headSha && pull.head?.ref === branch, "STALE_GITHUB_HEAD", "The PR does not identify the verified feature Head.");
    assert(pull.base?.ref === baseBranch, "STALE_GITHUB_BASE", "The PR targets another base branch.");
    if (baseSha !== undefined) assert(pull.base?.sha === baseSha, "STALE_GITHUB_BASE", "The PR base does not identify the verified base SHA.");
    return pull;
  }

  async function inspectMerge({ pullRequest, branch, baseBranch, headSha, baseSha, evidenceComment }) {
    assert(Number.isInteger(pullRequest) && typeof branch === "string" && typeof baseBranch === "string" && isSha(headSha) && isSha(baseSha), "INVALID_GITHUB_QUERY", "Merge inspection requires PR, feature/base branches, exact Head, and exact base SHA.");
    assert(typeof evidenceComment === "string" && evidenceComment.includes(`<!-- ai-sdlc-evidence:${headSha} -->`), "INVALID_GITHUB_EVIDENCE", "Merge inspection requires the canonical local evidence comment.");
    const pull = await getExactPull({ pullRequest, branch, baseBranch, headSha });
    const merged = Boolean(pull.merged_at);
    assert(merged || pull.base?.sha === baseSha, "STALE_GITHUB_BASE", "The PR base does not identify the verified base SHA.");
    if (merged) {
      const comments = await allComments(api, { owner, repo, issue_number: pullRequest });
      const evidenceFound = comments.some((comment) => comment.user?.login === evidenceAuthor && comment.body === evidenceComment);
      return validateGitHubSnapshot({
        repository: `${owner}/${repo}`,
        pullRequest,
        url: pull.html_url ?? null,
        branch,
        baseBranch,
        headSha,
        baseSha,
        draft: Boolean(pull.draft),
        mergeable: true,
        unresolvedThreads: 0,
        blockingReviews: 0,
        checksKnown: true,
        checks: [],
        evidenceHeadSha: evidenceFound ? headSha : null,
        merged: true,
        mergeSha: pull.merge_commit_sha ?? null,
      }, { repository: `${owner}/${repo}`, branch, baseBranch, headSha, baseSha });
    }
    const [remoteHead, remoteBase] = await Promise.all([branchSha(branch), branchSha(baseBranch)]);
    assert(remoteHead === headSha, "STALE_GITHUB_HEAD", "The live feature branch does not identify the verified Head.");
    assert(remoteBase === baseSha, "STALE_GITHUB_BASE", "The live base branch advanced beyond the locally verified base SHA.");

    const mergeCheckSha = isSha(pull.merge_commit_sha) && pull.merge_commit_sha !== headSha ? pull.merge_commit_sha : null;
    const [headCheckRuns, headStatuses, mergeCheckRuns, mergeStatuses, required, reviewFacts, comments] = await Promise.all([
      allCheckRuns(api, { owner, repo, ref: headSha }),
      allStatuses(api, { owner, repo, ref: headSha }),
      mergeCheckSha === null ? Promise.resolve([]) : allCheckRuns(api, { owner, repo, ref: mergeCheckSha }),
      mergeCheckSha === null ? Promise.resolve([]) : allStatuses(api, { owner, repo, ref: mergeCheckSha }),
      branchRequirements(baseBranch),
      allReviewThreads(api, { owner, repo, pullRequest }),
      allComments(api, { owner, repo, issue_number: pullRequest }),
    ]);
    const evidenceFound = comments.some((comment) => comment.user?.login === evidenceAuthor && comment.body === evidenceComment);
    const snapshot = {
      repository: `${owner}/${repo}`,
      pullRequest,
      url: pull.html_url ?? null,
      branch,
      baseBranch,
      headSha,
      baseSha,
      draft: Boolean(pull.draft),
      mergeable: pull.mergeable === true,
      unresolvedThreads: reviewFacts.nodes.filter((thread) => !thread.isResolved).length,
      blockingReviews: ["CHANGES_REQUESTED", "REVIEW_REQUIRED"].includes(reviewFacts.reviewDecision) ? 1 : 0,
      checksKnown: true,
      checks: requiredCheckFacts(required, headCheckRuns, headStatuses, mergeCheckRuns, mergeStatuses),
      evidenceHeadSha: evidenceFound ? headSha : null,
      merged: false,
      mergeSha: null,
    };
    return validateGitHubSnapshot(snapshot, { repository: `${owner}/${repo}`, branch, baseBranch, headSha, baseSha });
  }

  const adapter = {
    repository: `${owner}/${repo}`,

    async inspectDelivery({ branch, headSha }) {
      assert(typeof branch === "string" && branch.length > 0 && isSha(headSha), "INVALID_GITHUB_QUERY", "Branch and exact Head SHA are required.");
      const [remoteHead, pulls] = await Promise.all([
        branchSha(branch),
        api.rest.pulls.list({ owner, repo, head: `${owner}:${branch}`, state: "all" }),
      ]);
      const pull = pulls.data.find((candidate) => candidate.head?.sha === headSha) ?? null;
      const merged = Boolean(pull?.merged_at);
      if (!merged && remoteHead === null) return { pushed: false, pullRequest: null, ciPassed: false, merged: false, mergeSha: null };
      assert(merged || remoteHead === headSha, "STALE_GITHUB_HEAD", `GitHub Head SHA mismatch for ${branch}: received ${remoteHead}, expected ${headSha}.`);
      if (!pull) return { pushed: true, pullRequest: null, ciPassed: false, merged: false, mergeSha: null };
      const checks = await allCheckRuns(api, { owner, repo, ref: headSha });
      const ciPassed = checks.length > 0 && checks.every((check) => ["PASS", "SKIPPED"].includes(checkStatus(check)));
      const mergeSha = merged ? pull.merge_commit_sha ?? null : null;
      assert(!merged || isSha(mergeSha), "INVALID_GITHUB_RESPONSE", "GitHub reports a merged pull request without an exact merge SHA.");
      return {
        pushed: true,
        pullRequest: { number: pull.number, state: pull.state, draft: Boolean(pull.draft), url: pull.html_url ?? null, headSha: pull.head.sha },
        ciPassed,
        merged,
        mergeSha,
      };
    },

    async openPullRequest({ branch, baseBranch, headSha, title, body }) {
      const remoteHead = await branchSha(branch);
      assert(remoteHead === headSha, "STALE_GITHUB_HEAD", "The remote feature branch must equal the verified Head before opening a PR.");
      const existing = await api.rest.pulls.list({ owner, repo, head: `${owner}:${branch}`, base: baseBranch, state: "open" });
      const pull = existing.data.find((candidate) => candidate.head?.sha === headSha)
        ?? (await api.rest.pulls.create({ owner, repo, head: branch, base: baseBranch, title, body, draft: true })).data;
      assert(pull.head?.sha === headSha && pull.base?.ref === baseBranch, "STALE_GITHUB_HEAD", "GitHub created or returned a PR for another Head or base branch.");
      return { number: pull.number, url: pull.html_url ?? null, headSha, draft: Boolean(pull.draft) };
    },

    async appendEvidence({ pullRequest, branch, baseBranch, headSha, body }) {
      assert(Number.isInteger(pullRequest) && isSha(headSha), "INVALID_GITHUB_QUERY", "PR number and exact Head are required.");
      assert(typeof body === "string" && body.includes(`<!-- ai-sdlc-evidence:${headSha} -->`), "INVALID_GITHUB_EVIDENCE", "Evidence comment must carry the exact Head marker.");
      const pull = await getExactPull({ pullRequest, branch, baseBranch, headSha });
      const existing = (await allComments(api, { owner, repo, issue_number: pullRequest }))
        .find((comment) => comment.user?.login === evidenceAuthor && comment.body === body);
      if (existing) return { id: existing.id, url: existing.html_url ?? null, headSha, idempotent: true };
      assert(pull.draft === true, "GITHUB_PR_NOT_DRAFT", "New evidence must be appended while the pull request is Draft.");
      const response = await api.rest.issues.createComment({ owner, repo, issue_number: pullRequest, body });
      assert(response.data.user?.login === evidenceAuthor, "UNTRUSTED_GITHUB_EVIDENCE", "GitHub evidence was not authored by the configured Adapter identity.");
      return { id: response.data.id, url: response.data.html_url ?? null, headSha };
    },

    async markDraftForUpdate({ pullRequest, branch, baseBranch, headSha }) {
      const pull = await getExactPull({ pullRequest, branch, baseBranch, headSha });
      assert(!pull.merged_at, "GITHUB_ALREADY_MERGED", "A merged pull request cannot return to Draft.");
      if (pull.draft) return { number: pullRequest, draft: true, headSha, idempotent: true };
      assert(typeof pull.node_id === "string" && pull.node_id.length > 0, "INVALID_GITHUB_RESPONSE", "GitHub omitted the pull request node ID.");
      const response = await api.graphql(
        "mutation($pullRequestId:ID!){convertPullRequestToDraft(input:{pullRequestId:$pullRequestId}){pullRequest{isDraft}}}",
        { pullRequestId: pull.node_id },
      );
      assert(response.convertPullRequestToDraft?.pullRequest?.isDraft === true, "GITHUB_DRAFT_FAILED", "GitHub did not convert the pull request to Draft.");
      return { number: pullRequest, draft: true, headSha };
    },

    async markReadyForReview({ pullRequest, branch, baseBranch, headSha, body }) {
      assert(typeof body === "string" && body.includes(`<!-- ai-sdlc-evidence:${headSha} -->`), "INVALID_GITHUB_EVIDENCE", "Ready transition requires the canonical evidence body for the exact Head.");
      const pull = await getExactPull({ pullRequest, branch, baseBranch, headSha });
      const evidenceFound = (await allComments(api, { owner, repo, issue_number: pullRequest }))
        .some((comment) => comment.user?.login === evidenceAuthor && comment.body === body);
      assert(evidenceFound, "MISSING_GITHUB_EVIDENCE", "The exact trusted evidence comment must exist before Ready for Review.");
      if (!pull.draft) return { number: pullRequest, ready: true, headSha };
      assert(typeof pull.node_id === "string" && pull.node_id.length > 0, "INVALID_GITHUB_RESPONSE", "GitHub omitted the Draft PR node ID.");
      const response = await api.graphql(
        "mutation($pullRequestId:ID!){markPullRequestReadyForReview(input:{pullRequestId:$pullRequestId}){pullRequest{isDraft}}}",
        { pullRequestId: pull.node_id },
      );
      assert(response.markPullRequestReadyForReview?.pullRequest?.isDraft === false, "GITHUB_READY_FAILED", "GitHub did not mark the pull request ready for review.");
      return { number: pullRequest, ready: true, headSha };
    },

    inspectMerge,

    async mergeWhenReady(input) {
      const snapshot = validateGitHubSnapshot(await inspectMerge(input), {
        headSha: input.headSha,
        baseSha: input.baseSha,
        branch: input.branch,
        baseBranch: input.baseBranch,
      });
      if (snapshot.merged) {
        assertMerged(snapshot);
        return { merged: true, mergeSha: snapshot.mergeSha, snapshot };
      }
      assertMergeable(snapshot);
      const method = input.method ?? "squash";
      assert(["merge", "squash", "rebase"].includes(method), "INVALID_GITHUB_QUERY", "Merge method is not supported.");
      const response = await api.rest.pulls.merge({ owner, repo, pull_number: input.pullRequest, sha: input.headSha, merge_method: method });
      assert(response.data.merged === true && isSha(response.data.sha), "GITHUB_MERGE_FAILED", response.data.message ?? "GitHub did not merge the pull request.");
      return { merged: true, mergeSha: response.data.sha, snapshot };
    },
  };

  return adapter;
}

export function validateGitHubSnapshot(snapshot, expectedSubject) {
  const keys = ["repository", "pullRequest", "url", "branch", "baseBranch", "headSha", "baseSha", "draft", "mergeable", "unresolvedThreads", "blockingReviews", "checksKnown", "checks", "evidenceHeadSha", "merged", "mergeSha"];
  assert(snapshot && typeof snapshot === "object" && !Array.isArray(snapshot), "INVALID_GITHUB_SNAPSHOT", "GitHub snapshot must be an object returned by the live adapter.");
  const unexpected = Object.keys(snapshot).filter((key) => !keys.includes(key));
  assert(unexpected.length === 0 && keys.every((key) => Object.hasOwn(snapshot, key)), "INVALID_GITHUB_SNAPSHOT", "GitHub snapshot fields are incomplete or unexpected.", { unexpected });
  assert(typeof snapshot.repository === "string" && Number.isInteger(snapshot.pullRequest) && typeof snapshot.branch === "string" && typeof snapshot.baseBranch === "string", "INVALID_GITHUB_SNAPSHOT", "GitHub repository, PR, or branch is invalid.");
  assert((expectedSubject.repository === undefined || snapshot.repository === expectedSubject.repository) && snapshot.headSha === expectedSubject.headSha && snapshot.baseSha === expectedSubject.baseSha && snapshot.branch === expectedSubject.branch && snapshot.baseBranch === expectedSubject.baseBranch, "STALE_GITHUB_SNAPSHOT", "GitHub facts do not describe the canonical repository, verified branches, Head, and base.");
  assert(typeof snapshot.draft === "boolean" && typeof snapshot.mergeable === "boolean" && Number.isInteger(snapshot.unresolvedThreads) && snapshot.unresolvedThreads >= 0 && Number.isInteger(snapshot.blockingReviews) && snapshot.blockingReviews >= 0, "INVALID_GITHUB_SNAPSHOT", "GitHub merge or review facts are invalid.");
  assert(snapshot.checksKnown === true && Array.isArray(snapshot.checks), "UNKNOWN_GITHUB_CHECKS", "GitHub checks were not completely queried.");
  for (const check of snapshot.checks) {
    const checkKeys = Object.keys(check).sort().join(",");
    assert(checkKeys === "name,required,status", "INVALID_GITHUB_SNAPSHOT", "GitHub check facts must be closed objects.");
    assert(typeof check.name === "string" && ["PASS", "FAIL", "PENDING", "SKIPPED"].includes(check.status) && check.required === true, "INVALID_GITHUB_SNAPSHOT", "GitHub required-check fact is invalid.");
  }
  assert(snapshot.evidenceHeadSha === null || snapshot.evidenceHeadSha === expectedSubject.headSha, "STALE_GITHUB_EVIDENCE", "GitHub evidence describes another Head.");
  assert(typeof snapshot.merged === "boolean" && (snapshot.merged ? isSha(snapshot.mergeSha) : snapshot.mergeSha === null), "INVALID_GITHUB_SNAPSHOT", "GitHub merge result must contain an exact SHA only when merged.");
  return snapshot;
}

export function assertMergeable(snapshot) {
  assert(!snapshot.draft, "GITHUB_PR_DRAFT", "The pull request must be Ready for Review before merge.");
  assert(snapshot.mergeable, "GITHUB_NOT_MERGEABLE", "GitHub reports that the pull request is not mergeable.");
  assert(snapshot.unresolvedThreads === 0, "UNRESOLVED_REVIEW", "GitHub has unresolved review threads.");
  assert(snapshot.blockingReviews === 0, "CHANGES_REQUESTED", "GitHub has an outstanding changes-requested review.");
  assert(snapshot.evidenceHeadSha === snapshot.headSha, "MISSING_GITHUB_EVIDENCE", "The PR has no evidence comment for the current Head.");
  const blocking = snapshot.checks.filter((check) => check.required && !["PASS", "SKIPPED"].includes(check.status));
  assert(blocking.length === 0, "GITHUB_REQUIRED_CHECKS_NOT_GREEN", "Required GitHub checks are not complete and acceptable.", { blocking });
}

export function assertMerged(snapshot) {
  assert(snapshot.merged && isSha(snapshot.mergeSha), "GITHUB_NOT_MERGED", "GitHub does not report an exact merged result.");
  assert(snapshot.evidenceHeadSha === snapshot.headSha, "MISSING_GITHUB_EVIDENCE", "The merged PR has no exact trusted evidence comment for its feature Head.");
}

export function renderEvidenceComment(work, evidence) {
  const payload = {
    workId: work.workId,
    freezeCommitSha: evidence.subject.freezeCommitSha,
    specSha256: evidence.subject.specSha256,
    baseSha: evidence.subject.baseSha,
    headSha: evidence.subject.headSha,
    runs: evidence.runs.map(({ kind, checkId, headSha, worktreeSha256, exitCode, result, outputSha256, at }) => ({ kind, checkId, headSha, worktreeSha256, exitCode, result, outputSha256, at })),
    reviews: evidence.reviews,
  };
  return [
    `<!-- ai-sdlc-evidence:${evidence.subject.headSha} -->`,
    "## AI-SDLC evidence",
    "",
    `Work: \`${work.workId}\` · Head: \`${evidence.subject.headSha}\` · Freeze: \`${evidence.subject.freezeCommitSha}\``,
    "",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
  ].join("\n");
}
