---
name: implement-spec
description: "依已成立且可實作的 Spec 實作或修正產品碼與測試。適用於契約明確的功能、Bug 與 implementation／test finding；需求未定與純 setup 不適用。"
---

# Implement Spec

## Uses

- 新增或重構 module、interface 或 seam 時讀取 `.agents/skills/codebase-design/SKILL.md`；只有重大取捨才讀進階文件。
- TDD 前讀取 `.agents/skills/tdd/SKILL.md`；需要時再讀 `tests.md`／`mocking.md`。

## Workflow

1. 讀取 Spec、適用的 `AGENTS.md`、相關程式、測試與仍成立的 Review findings。
2. 若合理實作必須改變產品契約或缺少 build/test 基線，只回報 finding 類型與依據，再交回 root Router。
3. 依可獨立驗收的使用者行為安排 vertical slices，不預設 layer 或抽象。
4. 每個新 public seam 的第一個 Red 前，依目前模式確認或決定最小 public test seam，並在當次工作脈絡明示。
5. 每個 slice 依序：寫會因行為缺失而失敗的測試、確認正確 Red、完成最小 Green、執行受影響驗證。
6. 修正行為 finding 時先建立重現測試；純 refactor 或補測試不製造假 Red。
7. 載入 `codebase-design` 時只採用其設計概念，保留既有 domain vocabulary，不因術語不同而改名。
8. 完成時回報 changed files 與已完成的驗收條件、vertical slices、每個 slice 有效的 Red／Green 與受影響驗證結果，並提供可供 Agent 建立 coherent Commit 的 candidate；不另建 log 或 evidence file。
9. 將結果交回 root Router；Candidate Commit 後由 Router 對 committed Head 執行一次完整且適用的 format、static analysis、build、test、coverage 與其他交付檢查。

## Boundaries

- 不暗改 Spec，不執行最終 Review，也不宣告 Review PASS。
- 不選擇或啟動下一個 Stage Skill。
