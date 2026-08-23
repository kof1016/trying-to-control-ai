---
name: review-implementation
description: "分別從 Implementation／Test 兩個視角審查已完成適用驗證的產品變更或 setup 變更之 committed Head，輸出 verdict 與 findings。交付前或修正後複審時使用；不直接修正。"
---

# Review Implementation

## Uses

- 有新增／重構 module、interface 或 seam 時，讀取 `.agents/skills/codebase-design/SKILL.md`，只使用設計概念；保留既有 domain vocabulary，不因術語偏好不同產生 finding。
- 有新增／修改產品測試或 Test Review finding 時，讀取 `.agents/skills/tdd/SKILL.md`；需要時再讀 `.agents/skills/tdd/tests.md`／`.agents/skills/tdd/mocking.md`。只使用 seam、test quality、anti-pattern 與 mocking 準則，不啟動 Red → Green。

## Inputs

1. 輸入至少包含適用 Spec（純 setup 使用明確 task）、`AGENTS.md`、精確 Base SHA、精確 Head SHA、該 Head 的 validation 命令／結果，以及 `base...HEAD` 的完整 committed diff。
2. Validation 與 Review 必須來自 checkout 精確 Head 的乾淨工作樹，並使用精確 Base。最終 Review 只審查 `base...HEAD` 的 committed changes，並確認驗證結果精確對應受審 Head。
3. 若本任務仍有 staged／unstaged／untracked 變更，不得對目前 Head 給 final PASS；應在安全隔離的乾淨 worktree／checkout 重新驗證與審查，無法隔離時回報 scope／Head mismatch 給 root Router。

## Implementation Review

檢查：

- 是否完整符合 Spec／task，且沒有越界。
- 錯誤、邊界、安全、相容性與資料處理是否合理。
- 是否符合語言、技術棧與既有專案慣例。
- 是否新增目前需求與既有技術棧不需要的機制。
- 是否存在形成維護或正確性風險的 code smell：誤導命名、具體重複、死碼、過長多責任、隱藏耦合、不當抽象或無必要複雜度。主觀風格偏好不得形成 finding 或 FAIL。

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
Scope:
  Base: <sha>
  Head: <sha>
  Validation: <commands and results>

## Implementation Review
Verdict: PASS | FAIL
Findings: None | <blocking | non-blocking, responsibility: spec | setup | implementation | test, location, basis, impact, direction>

## Test Review
Verdict: PASS | FAIL
Findings: None | <blocking | non-blocking, responsibility: spec | setup | implementation | test, location, basis, impact, direction>

## Overall
PASS | FAIL
```

任一視角有 blocking finding 時，該視角與 Overall 都是 `FAIL`，並強制退回 root Router。Non-blocking finding 可以和 `PASS` 共存，只提供建議，不強制進入另一個 Stage。

Blocking 只限 Spec／task 違反、correctness、安全、相容性、可重現性或必要測試證據缺失；主觀偏好不得 blocking。所有 PASS／FAIL 與 findings 都回報 root Router。

## Boundaries

- 分別從 Implementation／Test 兩個視角審查，但不要求不同 Agent、固定 reviewer 或子代理數量。
- 不修改產品碼或測試、不選擇下一個 Stage Skill，也不負責 Git 交付。
- 只有 blocking finding 或 Overall FAIL 強制由 root Router 分流；non-blocking finding 照常回報但不阻擋交付。
- 不把偏好、單一數字或檔案數作為 blocking verdict。
