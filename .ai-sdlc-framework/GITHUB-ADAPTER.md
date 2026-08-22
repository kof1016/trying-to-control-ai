# GitHub Adapter binding

GitHub delivery is a trusted host boundary, not a JSON file or a local lifecycle state. The host that owns GitHub credentials constructs the Adapter with an authenticated Octokit-compatible API client and the exact login that will author evidence comments:

```js
import { createGitHubAdapter } from "./lib/github-adapter.mjs";
import { mergeWhenReady, preflight } from "./lib/engine.mjs";

const adapter = createGitHubAdapter({
  api,                 // authenticated host capability; never serialized
  owner: "example",
  repo: "project",
  evidenceAuthor: "framework-bot",
});

const local = await preflight(repositoryRoot, { workId, action: "publish", authorizationSource: publishAuthorization });
// Push local.subject.headSha through the host's authenticated Git transport.
const pull = await adapter.openPullRequest({
  branch,
  baseBranch,
  headSha: local.subject.headSha,
  title,
  body,
});
// Existing Ready PR + newly pushed Head only:
// await adapter.markDraftForUpdate({ pullRequest: pull.number, branch, baseBranch, headSha: local.subject.headSha });
await adapter.appendEvidence({ pullRequest: pull.number, branch, baseBranch, headSha: local.subject.headSha, body: local.evidenceComment });
await adapter.markReadyForReview({ pullRequest: pull.number, branch, baseBranch, headSha: local.subject.headSha, body: local.evidenceComment });
await mergeWhenReady(repositoryRoot, { workId, pullRequest: pull.number, githubAdapter: adapter, authorizationSource: mergeAuthorization });
```

The injected client must provide `rest.git`, `rest.pulls`, `rest.checks`, `rest.issues`, `rest.repos.getBranchProtection`, `rest.repos.getBranchRules`, `rest.repos.getCombinedStatusForRef`, and `graphql`. A platform connector may bind equivalent calls, but it must preserve the same exact inputs and trusted identity; caller-authored snapshots are not an Adapter.

`publishAuthorization` is required only in supervised mode. `mergeAuthorization` is required in supervised and delegated modes; both are short trusted-host descriptions of the explicit approval. Autonomous mode passes neither. The returned `deliveryPolicy` tells the host which pause applies.

Before merge, the engine binds `adapter.repository` to the local `origin` GitHub identity. The Adapter then re-queries the exact base branch/SHA and feature Head, paginates Required Checks, statuses, rules and review threads, verifies the exact evidence body and author, rejects Draft or blocked PRs, and calls GitHub merge with the expected Head SHA. If GitHub reports any check or status for the PR test-merge commit, every Required context is evaluated on that commit; only a test-merge commit with no check/status facts falls back to the feature Head. A branch ruleset type the Adapter does not mechanically prove (for example required workflows, deployments, code scanning, merge queue or pull-request rules) fails closed instead of relying on a credential's possible bypass rights. Non-Required CI is observed but is not an extra merge gate.

`appendEvidence` is idempotent after a crash if the exact trusted comment already exists. When an existing Ready PR receives a new Head, the host calls `markDraftForUpdate`, appends that Head's newly verified evidence, then calls `markReadyForReview` again.

After GitHub already reports the exact PR as merged, recovery verifies the PR's feature Head, target branch, exact merge SHA and trusted evidence comment. It does not reinterpret later check, review or ruleset state as if the merge were still pending.

The local-evidence and platform atomicity limits are explicit in `TRUST-MODEL.md`.
