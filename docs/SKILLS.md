# Matt Pocock Skills 稽核與使用契約

## 結論先行

來源固定為 `mattpocock/skills@0ab1b63a410a03d3627979a109c8695de27af954`。`skills@1.5.23` 稽核工具在該 commit 可發現 35 個 Skill；本版只安裝：

1. `grilling`
2. `tdd`
3. `codebase-design`

不是 6、7、12 個，也不安裝整套。精確來源、Git tree、檔案 SHA-256 與完整候選集在 [`third_party/matt-pocock-skills.lock.json`](../third_party/matt-pocock-skills.lock.json)。

## 方法 Skill 如何嵌入流程

Skill 只提供局部方法，不擁有外層 SDLC。Spec freeze、品質命令、commit、Review、Push 與 Merge 仍由 repository-owned 文件控制。

| Skill | Codex 何時使用 | 完成界線 | 不得做的事 |
|---|---|---|---|
| `grilling` | Spec 還有真正的需求、scope、驗收、風險或授權決策時 | 所有可達的決策 frontier 已回答，使用者確認共同理解 | 不直接把訪談當 Frozen Spec；不自行替人類作需求決策 |
| `tdd` | Frozen Spec 與 seam 已確認後，逐一實作 vertical slice | 一個測試先因正確原因 Red，再以最小實作 Green | 不接管 commit／Push；不一次批量寫測試；不替未知 seam 作決策 |
| `codebase-design` | `tdd` 或 Spec 工作真的遇到 interface／seam 形狀問題時，作詞彙與設計參考 | 釐清 module、interface、seam、adapter 的選擇與取捨 | 不是固定 phase；不得重開 Frozen Spec 已定設計；若需要改 seam，回到 Spec change control |

`tdd` 對 `codebase-design` 是**文件上的安裝硬依賴、執行時的條件軟依賴**：pinned `docs/engineering/tdd.md` 明寫前者需要安裝，`tdd/SKILL.md` 則只在 interface 形狀本身有疑問時呼叫。正常 A+B 實作若 Frozen Spec 已確認 seam，`codebase-design` 應保持休眠。

`codebase-design` 本體不寫檔、不 commit。只有人類確實要比較多個 interface 方案時，才可進入其 `DESIGN-IT-TWICE` 分支並啟動 3+ subagents；輸出只是供 Spec 決策的候選方案，不新增 gate 或固定 phase。

三者的 `agents/openai.yaml` 均未禁止 implicit invocation，因此 Codex 可依情境自動選用；不要求使用者輸入 slash command。它們會安裝到 repo scope `.agents/skills/`。

## 為何不用原版 `code-review`

重新評估後，committed-only diff **本身已不是衝突**：新流程先建立本機 Green commits，Push 前才 Review，原版可看見該 range。但 shipped Skill 仍不適合作 gate：

- 無條件先讀 `docs/agents/issue-tracker.md`，即使已直接提供 Frozen Spec。
- 強制 Standards／Spec subagents，卻沒有可靠的遞迴防護；上游記錄過 50+ agents 的遞迴問題。
- 聚合器傾向轉貼報告，沒有逐項 evidence recheck。
- 沒有固定 finding schema、severity／verdict contract，也沒有獨立 Test Review。
- description 宣稱可看 work-in-progress，實作實際只看 fixed point 到 `HEAD` 的 committed diff。

因此本版用 Codex 內建 review 能力配合 [`REVIEWS.md`](REVIEWS.md) 的兩份 repo-owned 規約；不為了留下 Matt Skill 而建 tracker 或改上游流程。

## `implement`、`to-spec` 與 tracker 的裁決

| 項目 | 裁決 | 直接原因 |
|---|---|---|
| `implement` | 排除 | 先呼叫只看 committed diff 的 `code-review`，最後才 commit；本次變更可能完全沒被看到。它也只做尾端 commit，缺少每個 Green stage、Format/Lint/Build/Coverage 與獨立 Test Review |
| `to-spec` | 排除 | 明定不訪談、綁 issue tracker 與 `ready-for-agent`，沒有「AI 拷問 → 人類 final confirm → repo commit freeze」 |
| `issue-tracker.md` | 不建立 | 入選三個 Skill 都不需要；public GitHub repo、PR、CI 與 branch protection 也不需要它 |
| `setup-matt-pocock-skills` | 排除 | 會為未採用的 tracker、triage、domain layout 建制，且要求人工啟動 |

## 全部 35 個候選的處置

Pinned tree 的 promoted manifest 有 25 個；`skills@1.5.23` 稽核工具另掃到 10 個 `in-progress/`／`misc/` Skill。本表逐一交代，避免用數量或舊名單倒推答案。

### Promoted 25

| Skill | 本版處置 | 原因 |
|---|---|---|
| `ask-matt` | 排除 | 完整 Matt suite router；本 repo 已有明確路由 |
| `diagnosing-bugs` | 排除 | hard bug 的事件型流程，不是正常 A+B loop |
| `grill-with-docs` | 排除 | wrapper 綁 `grilling`、domain model、ADR／glossary，對最小載體過重 |
| `triage` | 排除 | issue state machine 非必要 |
| `improve-codebase-architecture` | 排除 | 新生 A+B 尚無真實 architecture hot spot，且會產 HTML report／訪談 |
| `setup-matt-pocock-skills` | 排除 | 強建未採用的 tracker 與文件布局 |
| `tdd` | **安裝** | Red → Green、vertical slice、public seam 與 mock discipline |
| `to-spec` | 排除 | tracker-first、no interview、無 human freeze |
| `to-tickets` | 排除 | 最小 A+B point 不需要 ticket graph |
| `wayfinder` | 排除 | 面向跨多 session 的大型決策圖 |
| `implement` | 排除 | review／commit 次序錯置，並試圖接管不完整外層流程 |
| `prototype` | 排除 | 尚無需要 prototype 回答的實際問題 |
| `research` | 排除 | 非固定 SDLC step；有具體研究需求時另行評估 |
| `domain-modeling` | 排除 | A+B 尚無證據需要常設 glossary／ADR 流程 |
| `codebase-design` | **安裝** | `tdd` 的 pinned prerequisite；只作條件參考 |
| `code-review` | 排除原版 | tracker、遞迴、非結構化輸出與 Test Review 缺口 |
| `resolving-merge-conflicts` | 排除 | 事故型能力，沒有現存衝突 |
| `wizard` | 排除 | 尚無只能由人類操作的外部 setup 路徑 |
| `grill-me` | 排除 | 人工 wrapper；直接用可自動觸發的 `grilling` |
| `grilling` | **安裝** | 精確承接需求決策拷問 |
| `handoff` | 排除 | 本 repo 已有正式 handoff，不再疊一套壓縮流程 |
| `teach` | 排除 | 與 A+B SDLC 無關 |
| `to-questionnaire` | 排除 | 沒有外部受訪者需求 |
| `wait-what` | 排除 | 與流程無關 |
| `writing-for-agents` | 本次參考，不安裝 | 對本次分檔與 pointer 有用，但 runtime 不需要；常駐會把第三方 authoring philosophy 升格為 repo 行為 |

### 非 promoted 10

| Skill | 本版處置與原因 |
|---|---|
| `claude-handoff` | 排除；draft 且 Claude-specific |
| `loop-me` | 排除；draft |
| `setup-ts-deep-modules` | 排除；draft，且技術棧尚未選定 |
| `writing-beats` | 排除；寫作流程無關 |
| `writing-fragments` | 排除；寫作流程無關 |
| `writing-shape` | 排除；寫作流程無關 |
| `git-guardrails-claude-code` | 排除；Claude Code hooks，不是 Codex repo flow |
| `migrate-to-shoehorn` | 排除；特定 TypeScript library migration |
| `scaffold-exercises` | 排除；課程 scaffold |
| `setup-pre-commit` | 排除；預設 Husky／Prettier 並可能自行 commit，技術棧也未定 |

Pinned commit 中不存在舊稿曾提到的 `write-a-prd`、`create-a-plan`、`test-fixing`、`fixing-ci`、`using-git-worktrees`；不能把不存在的 Skill 留在清單。

## 自動安裝與更新規則

Bootstrap 時由 Codex 執行：

```text
node scripts/install-skills.mjs
node scripts/install-skills.mjs --verify
```

使用者不用手動執行。Repo-owned Script 以 Node.js 原生 HTTPS fetch，只下載 pinned commit 中 lock 列出的 10 個檔案；每檔先驗 SHA-256，再從隔離暫存目錄原子複製到 `.agents/skills/`。它不執行 Matt repository 或第三方 installer 的程式碼。若目標路徑含 symlink、同名內容不同，或存在其餘 32 個已稽核 Matt Skill 名稱，Script 會停止並保留現況，交由 Codex 查明 provenance；不自動覆寫或刪除。

刻意不用：

- `skills@latest`、`npx skills` 或任何第三方 installer runtime。
- 省略白名單的全量安裝。
- `mattpocock/skills#<commit>` 或 `/tree/<commit>`；`skills@1.5.23` 會把任意 SHA 當 branch clone，實測失敗。
- `skills update`；升級必須更換 pin、重做 35 項稽核、更新 lock，並以獨立 PR Review。
- `/init` 或要求使用者執行 setup Skill。

`skills@1.5.23` 只在本次稽核中用 `--list` 交叉驗證 35 個候選及測試其 pin 行為，不進入 bootstrap trust boundary。上游 direct archive 不會產生可證明來源的 `skills-lock.json`，所以本 repo 使用自己的逐檔 lock。
