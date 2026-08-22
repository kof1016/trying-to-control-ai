# AI-SDLC Framework Skill Architecture Refactor

## 確認依據

- 使用者提供的《AI-SDLC Framework v2.1 自主重構交接指令》是本需求的完整需求與自主執行授權。
- 使用者後續明確更正：GitHub Repository 的現行設定與歷史修正才是本次重構基準；舊 ZIP 不作為實作來源。
- 基準為 `kof1016/ai-work-flow-demo` 的 `main` commit `06bab4bd26e2f48fa02dad16a29a216086244bbc`。
- 本文件完成 Spec Review 後，以 Spec-only 本機 commit 凍結；該 commit 是實作與 Review 的唯一規格基準。

## 目標

將目前由大型自然語言 `WORKFLOW.md` 驅動、容易被 Agent 跳過的流程，重構為可安裝、可更新、可恢復、可機械驗證且 fail-closed 的 AI-SDLC Framework，同時保留需要語意判斷的工作給 AI Skills。

## 可驗收條件

- [ ] 根 `AGENTS.md` 只作為精簡 Router：讀取狀態、找出下一個合法工作、載入必要 Skill 或執行固定 Gate。
- [ ] Framework 靜態 Kernel、contracts、templates、scripts 與 adapters 和 `.ai-sdlc/` Runtime Data 分離。
- [ ] Lifecycle 至少區分 Foundation 與 Point；Point 的正常順序為 `SHAPING → DRAFT → FROZEN → POLICY_SET → EXECUTING → VERIFYING → REVIEWING → REVIEWED → PUBLISH_READY → PUBLISHED → MERGED`。
- [ ] `Confirmed` 是使用者確認目前 Spec 內容的事件與 Freeze guard，不是長期狀態；`FROZEN` 只在 Spec-only 本機 commit 與內容 hash 驗證成功後成立。
- [ ] Frozen Spec 在執行階段為唯讀；內容改變或不可行時回傳 `SPEC_CHANGE_REQUIRED`，清除下游證據並重新 shape、確認及 Freeze。
- [ ] Execution Policy 在 Freeze 後保存為結構化資料；監督、委派與全自動模式只改變 Approval Gate 的暫停點，不改變 Lifecycle、驗證、Review、CI 或 Merge 標準。
- [ ] Git SHA、Spec hash、狀態轉換、verification evidence、review freshness、publish preflight 與 delivery receipts 由固定程式及 contract 驗證；非法或缺證狀態一律拒絕前進。
- [ ] Feature Head SHA、Frozen Spec 或基準改變後，舊 verification、reviews 與 publish evidence 自動失效。
- [ ] Implementation Review 與 Test／Workflow Review 分開產生 verdict，兩者均須綁定同一最新 Head 與 Frozen Spec。
- [ ] Local 與 GitHub 平台差異由 Adapter 處理；Push、PR、CI、Merge、單一 Git 指令或模式選擇不拆成 Skill。
- [ ] 第一方 Skill 只在具備獨立觸發、AI 判斷與可驗收輸出時成立；初步候選為 Foundation、Shape Point、Execute Point、Review Change，最終數量須通過重疊、上下文與副作用邊界 Review，不以四個為硬性目標。
- [ ] Matt `grilling`、`tdd`、`codebase-design` 保持固定上游版本及原責任，不修改或 Fork；Framework 自行補足正式 Spec、Freeze、Lifecycle、Review、Evidence 與 Delivery。
- [ ] Bootstrap 不依賴尚未安裝的 Skill，能從發行內容安裝／更新第一方 Skills、靜態 runtime、Router block 與版本 lock，且不覆寫非 Framework 管理內容。
- [ ] 第三方 Skills 有可驗證的來源 lock、安裝方式與授權聲明。
- [ ] Framework 可產生明確邊界的發行包，不包含 Demo 產品程式、Runtime State 或歷史交付證據。
- [ ] 現有 A+B Demo 的產品行為與測試維持；歷史文件矛盾、缺漏的 formatting／coverage／CI 檢查與數值契約歧義須被明確處理或記錄。
- [ ] 建立可重跑的 automated checker、contract tests、CLI tests、package tests 與 clean-room drills。
- [ ] Clean-room 覆蓋 NEW、ADOPT、需求 shape、Spec-only freeze、三種模式、TDD、完整 verification、兩種 Review、publish、Spec change-control、失敗恢復、Head invalidation、Framework update、LF／CRLF 與新 Session Router 恢復。
- [ ] 本機完整驗證、Implementation Review、Test／Workflow Review 和 GitHub CI 均通過後，使用同一 feature branch 與單一 PR 完成交付；不得繞過失敗檢查或修改 Repository Settings。

## 架構邊界

### AI 判斷

- 判斷 NEW／ADOPT 的專案脈絡與必要 Foundation 工作。
- 需求決策前沿、正式 Spec 整理與可測性 Review。
- 依 Frozen Spec 進行 TDD、設計與實作。
- Implementation 與 Test／Workflow 的語意 Review。

### 固定控制

- Contract 與 schema 驗證。
- Lifecycle guard 與狀態轉換。
- Spec confirmation hash、Freeze commit ancestry 與唯讀檢查。
- Verification command 執行與 evidence envelope。
- Head／base SHA freshness、Review verdict 與 publish preflight。
- 安裝 manifest、版本 lock、發行包內容與 Adapter receipt 驗證。

### Runtime Data

`.ai-sdlc/` 保存 Project Foundation、Toolchain、Requests、Specs、Points、Execution Policy、Reviews、Evidence、Delivery receipts 與 Migration 記錄，不保存大型 Agent 操作說明。

## 非目標

- 不修改、Fork 或重新定義 Matt Skills。
- 不建立通用 Workflow DSL。
- 不為了此次重構更換 Java／Spring／Maven 技術棧或擴張 A+B 產品功能。
- 不修改 Branch Protection、Required Checks、Secrets 或其他 Repository Settings。
- 不以增加檔案或 Skill 數量作為成功標準。

## 驗證方式

- Node built-in tests 驗證 CLI、contracts、state guards、Git ancestry、freshness 與安裝／更新。
- 真實暫存 Git repositories 執行 NEW、ADOPT、Freeze、change-control、三種 policy、Review、Publish 與恢復 drills。
- Maven Wrapper `verify` 驗證 Demo 產品及 formatting、lint、test、build、coverage。
- 發行包解壓後以全新工作目錄執行 manifest 與 clean-room 驗證。
- 對完整 branch diff 分別執行 Implementation Review 與 Test／Workflow Review；所有 blocking findings 修正後重跑完整驗證。

## 交付

- Feature branch：`refactor/framework-skill-architecture`。
- 一個 Draft PR，後續所有 Review／CI 修正留在同一分支與 PR。
- Reviews 與 Required Checks 對最新 Head 全部成立後轉 Ready 並 Merge。
- 正式報告：`docs/AI-SDLC-Framework-v2.1-refactor-report.md`。
