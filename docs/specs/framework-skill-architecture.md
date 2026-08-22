# AI-SDLC Framework Skill Architecture Refactor

## 確認依據

- 使用者提供的《AI-SDLC Framework v2.1 自主重構交接指令》是本需求的完整需求與自主執行授權。
- 使用者後續明確更正：GitHub Repository 的現行設定與歷史修正才是本次重構基準；舊 ZIP 不作為實作來源。
- 使用者要求保留精簡方向：不得為了 fail-closed 引入龐大狀態機、Workflow DSL 或不必要術語；下一步應由已保存的客觀事實直接推導。
- 使用者後續授權：若符合自然流程可 Push，但本次交付不必把 CI 當成必要步驟；若平台實際設定 Required Checks，仍不得繞過平台限制。
- 基準為 `kof1016/ai-work-flow-demo` 的 `main` commit `06bab4bd26e2f48fa02dad16a29a216086244bbc`。
- 本文件完成 Spec Review 後，以 Spec-only 本機 commit 凍結；該 commit 是實作與 Review 的唯一規格基準。

## 目標

將目前由大型自然語言 `WORKFLOW.md` 驅動、容易被 Agent 跳過的流程，重構為可安裝、可更新、可恢復、可機械驗證且 fail-closed 的 AI-SDLC Framework，同時保留需要語意判斷的工作給 AI Skills。

## 可驗收條件

- [ ] 根 `AGENTS.md` 只作為精簡 Router：執行 `inspect`、採用唯一合法的下一步、載入必要 Skill 或執行固定 Gate。
- [ ] Framework 靜態 Kernel、contracts、templates、scripts 與 adapters 和 `.ai-sdlc/` Runtime Data 分離。
- [ ] 不保存一串人工流程狀態；`inspect` 直接根據 Project、Spec freeze、mode、目前 Git Head、verification、兩份 Review 與 delivery facts 推導唯一下一步。
- [ ] 對使用者只呈現設定、規格、實作、Review、交付五個白話階段；內部沒有通用 Workflow DSL。
- [ ] 使用者確認只是一筆綁定目前 Spec hash 的事實；Spec-only 本機 commit 與內容 hash 驗證成功後才成立 freeze。
- [ ] Freeze 與模式資料可在 feature branch 以 commit 保存並選擇性 Push，便於備份與跨 Session 接續；此時不開 PR、不要求遠端 CI，也不視為 Publish。
- [ ] Frozen Spec 在實作期間為唯讀；內容改變或不可行時，`inspect` 只回傳 `spec-change-needed`，清除下游證據並重新確認及 Freeze。
- [ ] 模式在 Freeze 後保存為結構化資料；supervised 在 Publish／Merge 前、delegated 在 Merge 前需要明確授權，autonomous 才可在 gates 成立後直接交付；模式不改變本機驗證、Review 或平台實際 Required Checks／Merge 標準，非 Required CI 不作人為 gate。
- [ ] Git SHA、Spec hash、verification、review freshness、publish preflight 與即時 delivery facts 由固定程式及 contract 驗證；缺少事實或順序不合法時一律拒絕前進。
- [ ] Feature Head SHA、Frozen Spec 或基準改變後，舊 verification、reviews 與 publish evidence 自動失效。
- [ ] Implementation Review 與 Test／Workflow Review 分開產生 verdict，兩者均須綁定同一最新 Head 與 Frozen Spec。
- [ ] Local 與 GitHub 平台差異由受信任 Adapter 處理；它綁定 canonical origin，固定 Draft→exact evidence→Ready 順序，Merge 前即時重查 base／Head／Required status checks／review facts，無法機械證明的 ruleset fail closed；Push、PR、CI、Merge、單一 Git 指令或模式選擇不拆成 Skill。
- [ ] 第一方 Skill 只在具備獨立觸發、AI 判斷與可驗收輸出時成立；候選為 `setup-project`、`define-requirement`、`implement-change`、`review-change`，最終仍須通過重疊、上下文與副作用邊界 Review，不以四個為硬性目標。
- [ ] Matt `grilling`、`tdd`、`codebase-design` 保持固定上游版本及原責任，不修改或 Fork；Framework 自行補足正式 Spec、Freeze、Review、Evidence 與 Delivery。
- [ ] Bootstrap 不依賴尚未安裝的 Skill，能從發行內容安裝／更新第一方 Skills、靜態 runtime、Router block 與版本 lock，且不覆寫非 Framework 管理內容。
- [ ] 第三方 Skills 有可驗證的來源 lock、安裝方式與授權聲明。
- [ ] Framework 可產生明確邊界的發行包，不包含 Demo 產品程式、Runtime State 或歷史交付證據。
- [ ] 現有 A+B Demo 的產品行為與測試維持；歷史文件矛盾、缺漏的 formatting／coverage／CI 檢查與數值契約歧義須被明確處理或記錄。
- [ ] 建立可重跑的 automated checker、contract tests、CLI tests、package tests 與 clean-room drills。
- [ ] Clean-room 覆蓋 NEW、ADOPT、需求 shape、Spec-only freeze、三種模式、TDD、完整 verification、兩種 Review、publish、Spec change-control、失敗恢復、Head invalidation、Framework update、LF／CRLF 與新 Session Router 恢復。
- [ ] 本機完整驗證、Implementation Review 與 Test／Workflow Review 均通過後，使用同一 feature branch 與單一 PR 完成交付；Push 可作自然備份點，不為形式主動要求 CI，且不得繞過實際 Required Checks 或修改 Repository Settings。

## 架構邊界

### AI 判斷

- 判斷 NEW／ADOPT 的專案脈絡與必要設定。
- 需求決策前沿、正式 Spec 整理與可測性 Review。
- 依 Frozen Spec 進行 TDD、設計與實作。
- Implementation 與 Test／Workflow 的語意 Review。

### 固定控制

- Contract 與 schema 驗證。
- 根據已保存事實推導下一個合法動作。
- Spec confirmation hash、Freeze commit ancestry 與唯讀檢查。
- Verification command 執行與 evidence envelope。
- Head／base SHA freshness、Review verdict 與 publish preflight。
- 安裝 manifest、版本 lock、發行包內容與 Adapter 即時回應驗證。

### Runtime Data

`.ai-sdlc/` 保存 Project、Toolchain、Work（request、Spec、freeze、mode）、Reviews、Evidence 與 Migration 記錄；GitHub delivery facts 每次即時查詢，不保存 receipt，也不保存大型 Agent 操作說明或流程引擎。

## 非目標

- 不修改、Fork 或重新定義 Matt Skills。
- 不建立通用 Workflow DSL。
- 不為了此次重構更換 Java／Spring／Maven 技術棧或擴張 A+B 產品功能。
- 不修改 Branch Protection、Required Checks、Secrets 或其他 Repository Settings。
- 不以增加檔案或 Skill 數量作為成功標準。
- 不對具有任意 Repository 寫入權的惡意本機行程提供密碼學 attestation，也不宣稱 GitHub 僅接受 Head CAS 的 REST merge 具備 base SHA 原子鎖；這些信任與平台限制必須明文記錄。

## 驗證方式

- Node built-in tests 驗證 CLI、contracts、事實推導、Git ancestry、freshness 與安裝／更新。
- 真實暫存 Git repositories 執行 NEW、ADOPT、Freeze、change-control、三種 policy、Review、Publish 與恢復 drills。
- Maven Wrapper `verify` 驗證 Demo 產品及 formatting、lint、test、build、coverage。
- 發行包解壓後以全新工作目錄執行 manifest 與 clean-room 驗證。
- 對完整 branch diff 分別執行 Implementation Review 與 Test／Workflow Review；所有 blocking findings 修正後重跑完整驗證。

## 交付

- Feature branch：`refactor/framework-skill-architecture`。
- 一個 Draft PR；若平台自動啟動 CI，只記錄實際結果，不把非 Required CI 當成本任務的人為前置條件。
- Reviews 與實際 Required Checks（若有）對最新 Head 成立後轉 Ready 並 Merge。
- 正式報告：`docs/AI-SDLC-Framework-v2.1-refactor-report.md`。
