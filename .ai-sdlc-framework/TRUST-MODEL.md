# Trust model

AI-SDLC Framework is a guardrail for an authorized, cooperative-but-fallible coding agent. Exact hashes, Git ancestry, closed contracts and live GitHub queries prevent stale evidence, accidental reordering and unsupported progression. They do not make a process with arbitrary Repository write access cryptographically trustworthy.

- `.ai-sdlc/local/` evidence is ignored local data, not a signed attestation. A malicious local writer can fabricate it. For adversarial execution, run checks and Reviews in an isolated trusted service and bind its signed attestation in the GitHub Adapter.
- The injected GitHub API client and configured evidence author are trusted host capabilities. Use least privilege and do not grant branch/ruleset bypass. The Adapter rejects rules it cannot prove instead of assuming a privileged merge will enforce them.
- GitHub's REST merge call supports an expected Head SHA but no expected base SHA. The Adapter checks the live base immediately before the call; atomic up-to-date enforcement, when required, must also be configured on GitHub and enforced for the Adapter identity.
- Semantic Review remains an AI judgment recorded against exact code and Spec. Hashes prove which bytes were reviewed, not that the judgment was honest or correct.

Within this boundary, a caller-authored GitHub snapshot, hand-written lifecycle state or conversation memory is never accepted as remote fact.
