# AI-SDLC Demo 協作規則

## 對話

每個任務開始前完整讀取並遵守 [`CONVERSATION_RULES.md`](CONVERSATION_RULES.md)。

## 模式

未指定時使用模式 1。每個新任務開始時顯示一次：

```text
目前執行模式：{{MODE_NO}} — {{MODE_ZH}}（{{MODE_EN}}）
1 — 逐步確認（supervised）
2 — 全自動（autonomous）：自動完成 Commit、Push、PR、CI 驗證與符合條件後 Merge；只有硬阻塞或使用者明確排除的操作才停止。
切換方式：「切換到 1／2」、「切換到逐步確認／全自動」或「switch to supervised／autonomous」。
```

模式只存在目前任務，不寫入 Repository；切換只影響尚未決定的步驟，不回溯已完成工作，也不跳過適用的 Spec、TDD、驗證或 Review。

## Router

| 情況 | 使用 Skill |
| --- | --- |
| 新需求的公開行為、驗收條件或重要邊界未定 | `$write-spec` |
| 目前交付缺少可重現的 build/test 基線 | `$prepare-project` |
| Spec 已確認，需要實作或修正產品碼／測試 | `$implement-spec` |
| 實作或 setup 已完成驗證，需要交付判定 | `$review-implementation` |

一般產品流程：`write-spec →（必要時 prepare-project）→ implement-spec → validation → review-implementation`

純 setup 流程：`prepare-project → validation → review-implementation`

Review finding 依責任交回：Spec → `write-spec`；setup → `prepare-project`；產品碼／測試 → `implement-spec`。修正後重新驗證並重做兩個 Review 視角。

純文件或簡單設定只做風險相稱的驗證；TDD 只用於可測產品行為，Codebase Design 只用於 coding／refactor。

## Repository 規則

- 修改 `examples/<project>/` 前先讀取該目錄的 `AGENTS.md`。
- `specs/` 只保存目前產品行為契約；需求變更時直接更新或刪除失效內容。
- Commit 依 coherent reason 組織並使用 Conventional Commit；一個需求使用一個 feature branch 與 PR。
- 最終驗證、Implementation Review、Test Review 與 PR 必須對應同一個已提交 Head；新 Commit 後全部重跑。
- Push、PR、CI 與 Merge 遵守 Branch Protection。

## Autonomous 硬阻塞

只有無法確認正確 Repository／基準、無法安全隔離未提交內容、缺少必要權限或真人 approval、沒有可用驗證途徑、外部 Required CI 持續失敗且無法從 Repository 修正，或公開行為真正互斥且無合理判斷依據時才能停止。
