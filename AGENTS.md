# AI-SDLC Demo 協作規則

## 對話

每個任務開始前完整讀取並遵守 [`CONVERSATION_RULES.md`](CONVERSATION_RULES.md)。

## 模式

未指定時使用模式 1。每個新任務開始時顯示一次：

```text
目前執行模式：{{MODE_NO}} — {{MODE_ZH}}（{{MODE_EN}}）
1 — 逐步確認（supervised）：遇到未決事項時逐步詢問使用者。
2 — 全自動（autonomous）：自動完成 Commit、Push、PR、CI 驗證與符合條件後 Merge；只有硬阻塞或使用者明確排除的操作才停止。
切換方式：「切換到 1／2」、「切換到逐步確認／全自動」或「switch to supervised／autonomous」。
```

模式只存在目前任務，不寫入 Repository；切換只影響尚未決定的步驟，不回溯已完成工作，也不跳過適用的 Spec、TDD、驗證或 Review。

## Router

Root `AGENTS.md` 是唯一的跨階段 Router。只有 Router 能選擇下一個 lifecycle stage；Stage Skill 只完成目前階段、回報結果與證據，再交回 Router。Agent 在每個 Stage Skill 返回後重新依本節判斷，直到完成交付或遇到硬阻塞。

Support Skill（`grilling`、`tdd`、`codebase-design`）只提供目前階段內的方法，不能取代 Stage Skill 或決定下一階段。

### 交付目標

- 使用者明確指定的 project／技術棧優先；交付目標是 Router context，除非它本身屬於產品契約，否則不寫入 Spec。
- 未指定且首次需要 project-specific 規則或基線時，supervised 模式先詢問使用者；autonomous 模式選擇有 Repository 證據且不擴大範圍的既有目標，明示目標與依據後繼續。
- 有適用的既有目標時，不自行改建另一個 project；沒有合理選擇或多個目標同等合理時，依既有硬阻塞停止並詢問使用者。

| 情況 | 使用 Skill |
| --- | --- |
| 純 setup task 缺少可重現的 build/test 基線或有 setup finding | `$prepare-project`；不建立產品 Spec |
| 產品需求的公開行為、驗收條件或重要邊界未定，或有 Spec finding | `$write-spec` |
| Spec 已成立但缺少可重現的 build/test 基線或有 setup finding | `$prepare-project` |
| Spec 與基線已成立，需要實作、修正產品碼／測試或處理 implementation／test finding | `$implement-spec` |
| Candidate 已提交，且該 Head 已完成適用驗證 | `$review-implementation` |

「Spec 已成立」在 supervised 模式代表使用者已確認；在 autonomous 模式代表 Agent 已定稿，並記錄 Agent 已採用且影響契約的假設。只有沒有合理判斷依據時才依既有硬阻塞停止。

`validation` 不是獨立 Skill：Stage 內只執行受影響檢查；Candidate Commit 後由 Router 對 committed Head 執行一次完整且適用的交付檢查。

Final validation 與 Review 必須在精確 committed Head 的乾淨工作樹執行。若 staged、unstaged 或 untracked 檔案可能影響驗證內容，不能把結果視為該 Head 的證據；應安全隔離到該 Head 的乾淨 worktree／checkout，無法安全隔離時依既有硬阻塞停止。

一般產品流程：`write-spec →（必要時 prepare-project）→ implement-spec → Commit → validation → review-implementation → PASS：Push → PR → Required CI → Merge`

純 setup 流程：`prepare-project → Commit → validation → review-implementation → Git 交付`

Review、PR review 或 CI 的 blocking finding，或 Review Overall FAIL，強制由 Router 依責任分流：Spec → `write-spec`；setup → `prepare-project`；產品碼／測試 → `implement-spec`。Non-blocking finding 照常回報，但可與 PASS 共存，不阻擋後續交付，也不強制進入另一個 Stage；若 Router 決定修正，任何新 Commit 都要對新 Head 重新執行完整適用驗證，並重做 Implementation Review 與 Test Review。

只有 Review PASS 後才能 Push、建立 PR、驗證 Required CI 與在符合條件後 Merge。若目標 base／`main` 在 Merge 前更新，先整合到同一個 feature branch；產生的新 Head 必須重跑完整適用驗證、Implementation Review 與 Test Review。

純文件或簡單設定只做風險相稱的驗證；TDD 只用於可測產品行為，Codebase Design 只用於 coding／refactor。

## Repository 規則

- 修改 `examples/<project>/` 前先讀取該目錄的 `AGENTS.md`。
- `specs/` 只保存目前產品行為契約；需求變更時直接更新或刪除失效內容。
- Commit 依 coherent reason 組織並使用 Conventional Commit；一個需求使用一個 feature branch 與 PR。
- 最終驗證、Implementation Review、Test Review 與 PR 必須對應同一個已提交 Head；新 Commit 後全部重跑。
- Push、PR、CI 與 Merge 遵守 Branch Protection。

## Autonomous 硬阻塞

只有無法確認正確 Repository／基準／交付目標、無法安全隔離未提交內容、缺少必要權限或真人 approval、沒有可用驗證途徑、外部 Required CI 持續失敗且無法從 Repository 修正，或公開行為真正互斥且無合理判斷依據時才能停止。
