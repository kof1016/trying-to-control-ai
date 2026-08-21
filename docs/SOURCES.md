# 來源與驗證紀錄

最後驗證：2026-08-21。外部內容會變動；本文件用 pinned source 支撐可重現項目，用官方現行文件支撐平台行為。未來升級前要重新驗證，不能只改 URL 或版本字串。

## Matt Pocock Skills

- [Pinned commit `0ab1b63a410a03d3627979a109c8695de27af954`](https://github.com/mattpocock/skills/commit/0ab1b63a410a03d3627979a109c8695de27af954)
- [Promoted manifest](https://github.com/mattpocock/skills/blob/0ab1b63a410a03d3627979a109c8695de27af954/.claude-plugin/plugin.json)
- [`grilling`](https://github.com/mattpocock/skills/blob/0ab1b63a410a03d3627979a109c8695de27af954/skills/productivity/grilling/SKILL.md)
- [`tdd`](https://github.com/mattpocock/skills/blob/0ab1b63a410a03d3627979a109c8695de27af954/skills/engineering/tdd/SKILL.md) 與其 [prerequisite 說明](https://github.com/mattpocock/skills/blob/0ab1b63a410a03d3627979a109c8695de27af954/docs/engineering/tdd.md)
- [`codebase-design`](https://github.com/mattpocock/skills/blob/0ab1b63a410a03d3627979a109c8695de27af954/skills/engineering/codebase-design/SKILL.md)
- [`code-review`](https://github.com/mattpocock/skills/blob/0ab1b63a410a03d3627979a109c8695de27af954/skills/engineering/code-review/SKILL.md) 與 [已知問題說明](https://github.com/mattpocock/skills/blob/0ab1b63a410a03d3627979a109c8695de27af954/docs/engineering/code-review.md)
- [`implement`](https://github.com/mattpocock/skills/blob/0ab1b63a410a03d3627979a109c8695de27af954/skills/engineering/implement/SKILL.md)
- [`to-spec`](https://github.com/mattpocock/skills/blob/0ab1b63a410a03d3627979a109c8695de27af954/skills/engineering/to-spec/SKILL.md)
- [`writing-for-agents`](https://github.com/mattpocock/skills/blob/0ab1b63a410a03d3627979a109c8695de27af954/skills/productivity/writing-for-agents/SKILL.md)，只作本次 authoring 參考，未列入安裝清單
- [MIT License](https://github.com/mattpocock/skills/blob/0ab1b63a410a03d3627979a109c8695de27af954/LICENSE)

稽核方法：以 pinned tree 搜尋全部 `SKILL.md`，並用 `skills@1.5.23 add <commit-archive> --list` 交叉驗證該工具可見的 35 項；再逐一檢查 metadata、流程、副作用與相依。選定三項以 repo-owned downloader 實際安裝，和 pinned files 逐檔 SHA-256 比對。

## 稽核工具與 repo-owned installer

- [`skills` npm package v1.5.23](https://www.npmjs.com/package/skills/v/1.5.23)
- [Vercel Labs Skills CLI pinned source](https://github.com/vercel-labs/skills/tree/435076e78988e1e6ec40d00b0b1d76bdbbc5419a)

`skills@1.5.23` 只用於本次候選發現與交叉測試，不在 bootstrap 執行：其 transitive runtime dependencies 使用 semver ranges，固定頂層版本仍不是完整可重現的執行環境。另已實測 raw `owner/repo#<commit-SHA>` 與 `/tree/<commit-SHA>` 會嘗試 `git clone --branch <SHA>` 而失敗，direct archive 也不會留下可信 source lock。

正式 installer 是本包的 `scripts/install-skills.mjs`：直接取得 pinned commit 的白名單檔案、核對逐檔 SHA-256、拒絕 symlink 與不相符的既有 Skill，且不執行第三方安裝程式。`.gitattributes` 固定 Skill 與驗證檔為 LF，避免 Windows checkout 改變 raw-byte hash。

## OpenAI Codex

- [AGENTS.md discovery](https://developers.openai.com/codex/agent-configuration/agents-md)
- [Build and use Skills](https://developers.openai.com/codex/build-skills)
- [Codex best practices and review](https://developers.openai.com/codex/learn/best-practices)
- [Codex GitHub Action](https://developers.openai.com/codex/github-action)
- [Codex Cloud](https://developers.openai.com/codex/cloud)

這些官方文件支撐：`AGENTS.md` 的階層式入口、repo-scope `.agents/skills`、Codex 的 implicit Skill policy、內建 review 能力、GitHub Action 可作正式 Review，以及 Cloud 是可選的隔離工作入口。

## GitHub gates 與 security

- [About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
- [Create rulesets（含 ref pattern 的 `fnmatch` 語法）](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)
- [Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [Dependency Review Action](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/configure-dependency-review-action)
- [CodeQL default setup](https://docs.github.com/en/code-security/code-scanning/enabling-code-scanning/configuring-default-setup-for-code-scanning)
- [About secret scanning](https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning)

這些來源刻意區分 workflow check、CodeQL setup、secret scanning 平台能力與 ruleset；`CI-CD.md` 沒有把所有能力偽裝成同一種 Action job。

## 本包驗證

- `node scripts/check-handoff.mjs`：檔案拓撲、內部 Markdown links、v1 作廢聲明、第一階段禁區、lock 與 installer self-check。
- `node scripts/install-skills.mjs`：在隔離暫存目錄實際下載與安裝 exact whitelist，逐檔比對後才複製。
- `node scripts/install-skills.mjs --verify`：離線核對已安裝內容與 lock。
