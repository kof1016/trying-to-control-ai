---
name: review-implementation
description: "從 Implementation 與 Test 兩個獨立視角審查已完成且具備適用驗證結果的產品實作或專案 setup。當實作完成、setup 完成、修正後需要重新審查，或交付前需要判斷是否符合 Spec／明確 task 時使用；此 Skill 只提出 verdict 與 findings，不直接修正內容。"
---

# Review Implementation

## Outcome

對目前完整變更產生 Implementation Review、Test Review 與整體 `PASS`／`FAIL`，讓每個 blocking finding 都能交回正確 Skill 修正。

## Uses

- `codebase-design`：讀取 `.agents/skills/codebase-design/SKILL.md`，審查 production code 的職責、interface、seam、過度拆分與過度合併。
- `tdd`：讀取 `.agents/skills/tdd/SKILL.md`，需要細節時再讀同目錄的 `tests.md`／`mocking.md`；只作測試品質、public seam、assertion、failure sensitivity 與 mocking 邊界的參考，不在 Review 階段重新執行 TDD 流程。

## Review Baseline

1. 讀取適用的 Spec；純 setup 任務則使用明確 task 或 handoff。
2. 讀取 root 與目標專案的 `AGENTS.md`。
3. 檢查相對 base 的完整預定變更、相關程式與測試。若存在 staged 或 unstaged 的任務內修改，不得漏出 Review 範圍。
4. 讀取實際執行過的驗證命令與結果；本機工具不可用時可讀取確實對應目前 Head 的 CI 結果，不以口頭宣稱代替可查證結果。
5. Finding 修正後，把新的完整變更視為新的 Review baseline，重新執行兩個視角。

## Implementation Review

逐項對照 Spec 或明確 task，檢查：

- 公開與可觀察行為是否正確、完整且沒有超出範圍。
- 錯誤、邊界、安全、相容性與資料處理是否合理。
- 程式是否符合現有語言與 Framework 慣例。
- 職責與 test seam 是否清楚且可獨立驗證。
- 是否保留具有實際責任的自然分層。
- 是否存在只負責轉發、沒有真實變化或只為假想擴充建立的抽象。
- 是否為了減少檔案而過度合併不同責任。
- 是否新增沒有目前 Spec、既有技術棧或驗收條件支持的 Runtime、script、狀態或 Framework 機制。

使用 `$codebase-design` 作為判斷準則，但不要把其抽象詞彙強迫改成原始碼名稱。只有確有重大 interface 或 seam 問題時才讀取其進階文件。

## Test Review

把每項適用驗收條件與主要風險對應到實際測試或驗證，檢查：

- 測試是否透過 public seam 驗證行為，而不是耦合內部實作。
- 測試是否真的會在行為錯誤時失敗，而不是 tautological assertion。
- 正常路徑、重要邊界與錯誤路徑是否有風險相稱的覆蓋。
- Assertion 是否明確且來自 Spec、固定範例或其他獨立預期值。
- Mock 是否只用在適當邊界，沒有模擬被測物件內部協作者。
- 測試層級是否合理，沒有用大量慢速整合測試取代可獨立驗證的核心行為，也沒有只靠 Unit Test 遺漏公開協定。
- 實際驗證命令是否成功，且測試數量與結果符合預期。

Coverage 百分比與命令 Green 都不能單獨取代 Test Review。

純 setup 沒有產品行為時，檢查 build/test 基線是否可重現、命令是否足以暴露設定錯誤；不要為了形式要求產品 TDD 測試。

## Verdict Format

直接輸出下列區塊，不建立獨立狀態檔或模板檔：

```text
## Implementation Review

Verdict: PASS | FAIL

Findings:
- Severity: blocking | non-blocking
  Location: <file, symbol, configuration, or behavior>
  Evidence: <what demonstrates the issue>
  Impact: <why it matters>
  Direction: <a verifiable correction direction>

## Test Review

Verdict: PASS | FAIL

Findings:
- Severity: blocking | non-blocking
  Location: <test, missing behavior, or validation command>
  Evidence: <what demonstrates the issue>
  Impact: <why it matters>
  Direction: <a verifiable correction direction>

## Overall

PASS | FAIL
```

沒有 finding 時明寫 `Findings: None`。任一視角存在 blocking finding 時，該視角與 Overall 都是 `FAIL`。

## Correction Loop

- 清楚 Spec 下的產品碼、測試、一般編譯／測試錯誤或實作偏差交回 `implement-spec`。
- Spec 本身缺漏、互斥，或合理修正必須改變公開行為時交回 `write-spec`。
- 純 setup、build/test 工具鏈或專案基線 finding 交回 `prepare-project`。
- 依問題責任分流，不依檔案副檔名；為產品功能修改 `pom.xml` 仍屬 `implement-spec`。
- Reviewer 不在同一次 Review 中直接修改自己正在判定的內容。
- 修正後重新執行完整適用驗證，再重新執行 Implementation Review 與 Test Review；先前 verdict 自然失效。
- 兩個視角的獨立性是判斷角度獨立，不要求固定 sub-agent 數量。

## Boundaries

- 不修改產品碼、測試、Spec 或 setup 設定。
- 不把非阻塞偏好升格成必須重構的問題。
- 不以檔案數、class 數、介面數或 coverage 數字作為單獨 verdict。
- 不建立 Evidence freshness、Review record、Hash 或流程狀態系統。
- Push、PR、CI 與 Merge 由 root `AGENTS.md` 的交付流程負責。
