---
name: review-implementation
description: "獨立審查已完成驗證的產品實作或 setup，輸出 Implementation／Test verdict 與 findings。交付前或修正後複審時使用；不直接修正。"
---

# Review Implementation

## Uses

- 有新增／重構 module、interface 或 seam 時，讀取 `.agents/skills/codebase-design/SKILL.md`。
- 有新增／修改產品測試或 Test Review finding 時，讀取 `.agents/skills/tdd/SKILL.md`；需要時再讀 `tests.md`／`mocking.md`。

## Inputs

1. 讀取適用 Spec（純 setup 使用明確 task）、`AGENTS.md`、相對 base 的完整變更及任務內 staged／unstaged 修改。
2. 確認驗證結果精確對應受審內容；最終交付判定必須對應 committed Head。

## Implementation Review

檢查：

- 是否完整符合 Spec／task，且沒有越界。
- 錯誤、邊界、安全、相容性與資料處理是否合理。
- 是否符合語言、技術棧與既有專案慣例。
- 是否新增目前需求與既有技術棧不需要的機制。

## Test Review

產品變更時，把驗收條件與主要風險對應到測試或驗證，檢查：

- 是否經 public seam 驗證，並會在行為錯誤時失敗。
- 正常、重要邊界與錯誤路徑是否有相稱覆蓋。
- Assertion 是否來自獨立預期值；Mock 是否只用於適當邊界。
- 測試層級是否合理，沒有遺漏公開協定。
- 驗證命令是否成功，且執行了預期測試。

Green 或 coverage 百分比不能單獨取代 Test Review。純 setup 則審查基線是否可重現且能暴露設定錯誤。

## Verdict

```text
## Implementation Review
Verdict: PASS | FAIL
Findings: None | <severity, location, basis, impact, direction>

## Test Review
Verdict: PASS | FAIL
Findings: None | <severity, location, basis, impact, direction>

## Overall
PASS | FAIL
```

任一視角有 blocking finding 時，該視角與 Overall 都是 `FAIL`。

## Boundaries

- Findings 依 root Router 分流；不把偏好、單一數字或檔案數作為 blocking verdict。
