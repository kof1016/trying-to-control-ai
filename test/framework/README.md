# Framework CLI contract tests

These tests exercise only the public process boundary:

```text
node .ai-sdlc-framework/bin/ai-sdlc.mjs <command> ... --root <repository>
```

A successful command exits `0` and writes one JSON value to stdout. A rejected
command exits non-zero and explains its fail-closed reason on stderr. CLI tests
use real temporary Git repositories; GitHub tests import only the documented
injected Adapter/engine library seam and use a deterministic API double.

Run the suite with:

```text
node --test test/framework/*.test.mjs
```

## Public commands

- `check-install`
- `inspect [--work-id <slug>]`
- `setup --mode NEW_CODEBASE|ADOPT_EXISTING --project-id <slug> --toolchain <json>`
- `start --work-id <slug> --request <markdown> --kind PRODUCT|SETUP|MIGRATION|FRAMEWORK`
- `freeze --work-id <slug> --confirmation-source <source>`
- `mode --work-id <slug> --mode supervised|delegated|autonomous`
- `verify --work-id <slug>`
- `review --work-id <slug> --type implementation|test --verdict PASS|BLOCKED --summary <text>`
- `reopen --work-id <slug> --reason <text>`
- `preflight --work-id <slug> --action publish [--authorization-source <source>]`

## Evidence-derived behavior

There is no lifecycle-state mutation command. Tracked authority consists of
`.ai-sdlc/project.json` and each work's `work.json`, `request.md`, and `spec.md`.
Local evidence records facts and binds them to the exact Git HEAD. `inspect`
derives exactly one top-level `nextAction`:

`setup-project`, `define-requirement`, `choose-mode`, `implement-change`,
`verify`, `review-change`, `deliver`, `done`, or `spec-change-needed`.

Frozen Spec drift has precedence over ordinary progress and requires `reopen`.
Verification and both independent PASS reviews bind the exact Git HEAD.
Changing HEAD invalidates downstream evidence. Modes alter approval policy
only, not verification, review, or delivery gates. `freeze` creates one local
Spec-only commit and never pushes.

GitHub delivery state is queried live through the injected Adapter library;
Draft→Ready and merge are not local CLI actions. The Adapter verifies the exact
base branch/SHA, Head, evidence author/body, review facts, and actual Required
Checks immediately before merge. Normal workflow never accepts user-fabricated
delivery receipts.
