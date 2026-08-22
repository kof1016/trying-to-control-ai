---
name: implement-spec
description: "依已確認的 Spec 實作或修正產品碼與測試。適用於契約明確的功能、Bug 與產品／測試 finding；需求未定與純 setup 不適用。"
---

# Implement Spec

## Uses

- 新增或重構 module、interface 或 seam 時讀取 `.agents/skills/codebase-design/SKILL.md`；只有重大取捨才讀進階文件。
- TDD 前讀取 `.agents/skills/tdd/SKILL.md`；需要時再讀 `tests.md`／`mocking.md`。

## Workflow

1. 讀取 Spec、適用的 `AGENTS.md`、相關程式、測試與仍成立的 Review findings。
2. 若合理實作必須改變產品契約，交回 `write-spec`；缺少 build/test 基線則交回 `prepare-project`。
3. 依可獨立驗收的使用者行為安排 vertical slices，不預設 layer 或抽象。
4. 第一個 Red 前依目前模式確認或決定最小 public test seam。
5. 每個 slice 依序：寫會因行為缺失而失敗的測試、確認正確 Red、完成最小 Green、執行受影響驗證。
6. 修正行為 finding 時先建立重現測試；純 refactor 或補測試不製造假 Red。
7. 執行所有適用的 format、static analysis、build、test、coverage 與其他檢查。
8. 將結果交由 `review-implementation`。

## Boundaries

- 不暗改 Spec，不執行最終 Review，也不宣告 Review PASS。
