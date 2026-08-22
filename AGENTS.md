# AI-SDLC Demo 協作規則

## 目的

這個 Repository 以文字規則與 Repository-scoped Skills 展示輕量 AI-SDLC。不要為流程建立 Framework Runtime、CLI、狀態機、模式／工作檔、Freeze、Hash、Manifest、Evidence 系統或新的腳本語言。

## 每個新任務的模式

從目前對話或任務指令判定模式；未指定時預設 `supervised`。每個新任務開始時顯示一次以下提醒，替換 `{{MODE}}`：

```text
目前執行模式：{{MODE}}

- supervised：重要決策與尚未授權的外部操作依規則等待確認。
- delegated：在已授權範圍內自動執行，超出邊界才詢問。
- autonomous：自行採取合理方案，只有硬阻塞才停止。

如需切換，直接說「切換為 supervised／delegated／autonomous」。
若未切換，將依目前模式繼續；模式不會跳過產品變更所需的 Spec、適用的 TDD、驗證或 Review。
```

`delegated`／`autonomous` 顯示提醒後立即繼續，不等待回覆。`supervised` 只有重要決策或外部操作尚未取得授權時才等待；已明確授權的操作不重問。

模式切換後只回覆一次：

```text
已切換為 {{MODE}}；從目前尚未決定的步驟繼續，不回溯已完成工作，也不跳過產品變更所需的 Spec、適用的 TDD、驗證或 Review。
```

除非使用者明確要求重做，切換不回溯已完成工作。模式只存在目前任務／對話，不寫入 Repository。

## Router

- 新產品需求、公開行為變更、驗收／邊界不清楚，或 Review 發現 Spec 本身缺漏／互斥：使用 `$write-spec`。
- 空白專案、目前交付被缺少 build/test 基線阻塞、setup-only task/finding：使用 `$prepare-project`。Repository 陌生或一般編譯／測試失敗不構成觸發。
- Spec ready、產品功能／Bug／程式／測試 finding：使用 `$implement-spec`。
- 實作或 setup 已完成並驗證、修正後複審、交付前判定：使用 `$review-implementation`。

一般產品流程：

`write-spec →（必要時 prepare-project）→ implement-spec → validation → review-implementation`

純 setup 流程：

`prepare-project → validation → review-implementation`

Review 只提出 Implementation Review、Test Review 與 findings，不直接修正。產品／程式／測試 finding 回 `implement-spec`；Spec finding 回 `write-spec`；純工具鏈／基線 finding 回 `prepare-project`。每次修正後重新完整驗證並重新執行兩個 Review 視角。

純文件或簡單設定只做風險相稱的驗證。只有可測的產品行為要求 TDD；只有 coding／refactor 才使用 Codebase Design。

## Repository 規則

- 修改 `examples/<project>/` 前先完整讀取該 project 的 `AGENTS.md`。
- 沿用既有技術棧與 Repository-native 工具，不為 Framework 新增 Node、Python 或其他 Runtime。
- Spec 只定義產品目標、可觀察行為、驗收、必要邊界／非目標與真正技術限制；不把 AI 偏好的 class、interface、adapter 或資料夾升格成需求。
- 依清楚且可獨立驗證的真實責任切分；保留自然分層，移除只轉發或只為假想擴充存在的抽象，也不為減少檔案而合併不同責任。
- Commit 依 coherent reason 組織，沿用 Conventional Commit 風格；不依每個檔案或 TDD cycle 硬拆。
- 使用 feature branch 與原生 PR template。最終驗證、兩個 Review 與 PR 必須對應同一個已提交 Head；新 commit 後全部重跑。
- Push、PR、CI 與 Merge 只在使用者授權範圍內執行，遵守 Branch Protection，不建立自訂 GitHub Adapter。

## 硬阻塞

在 `autonomous` 模式，只有以下情況可停止：無法確認正確 Repository／基準、無法安全隔離使用者未提交內容、缺少必要外部權限或真人 approval、沒有任何可用驗證途徑、外部 Required CI 持續失敗且 Repository 內無法修正，或公開行為存在真正互斥且沒有合理判斷依據。一般實作、測試、Review 或可修正 CI failure 不是硬阻塞。

