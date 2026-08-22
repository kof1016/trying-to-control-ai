---
name: implement-spec
description: "依已完成且足以實作的 Spec 完成產品程式、測試與本機驗證。當產品行為需要實作、既有行為需要修改、Bug 需要依規格修正，或 Implementation／Test Review finding 需要處理時使用；產品需求尚未確定或純 setup 問題不要使用。"
---

# Implement Spec

## Outcome

依 Spec 完成最小、可驗證且符合既有專案慣例的產品與測試變更，並讓 Repository-native 完整驗證通過。

## Uses

- `codebase-design`：讀取 `.agents/skills/codebase-design/SKILL.md`；coding 或 refactor 時使用其核心設計準則判斷職責、interface 與 test seam。它是設計參考，不是固定獨立階段。
- `tdd`：開始 TDD 前讀取 `.agents/skills/tdd/SKILL.md`，需要細節時再讀同目錄的 `tests.md`／`mocking.md`；對可測的產品行為執行 vertical-slice Red → Green，不讓它接管 Spec、Review 或 GitHub 交付。

## Workflow

1. 讀取適用的 Spec、root `AGENTS.md`、目標專案的局部 `AGENTS.md`、相關程式、測試及仍成立的 Review findings。
2. 確認 Spec 已足以實作。若合理實作必須改變產品行為、驗收或範圍，交回 `write-spec`，不要暗改需求。
3. 若目前缺少完成此 Spec 所需的 build/test 基線，先交由 `prepare-project` 建立最小工具鏈。
4. 把可觀察的驗收行為排成自然的 vertical slices。Vertical slice 是一個可獨立驗證的使用者行為，穿過完成它所需且已由真實責任合理化的自然層級，不是預先指定一個 function、class 或資料夾，也不要求新增 layer。
5. coding 或 refactor 時套用 `$codebase-design` 的核心準則：

   > 依照清楚且可獨立驗證的職責切分程式；保留具有實際責任的分層，移除沒有真實變化、只負責轉發或只為假想擴充建立的抽象。

6. 第一個 Red 前辨識本次 public test seam：

   - `supervised`：seam 尚未由 Spec 或專案規則確定時，先取得使用者確認。
   - `delegated`：在已授權範圍內選擇最小合理 seam；超出授權才詢問。
   - `autonomous`：把本任務全自主授權視為 seam 決策授權，依 Spec、既有 public API／tests 與局部 `AGENTS.md` 選擇最小合理 seam，簡短說明後直接繼續。

   不建立 confirmation、Hash 或 Evidence 檔。

7. 一次完成一個可測行為：

   1. 先寫一個會因行為尚未存在而失敗的測試。
   2. 實際執行並確認 Red 不是環境錯誤、非預期編譯錯誤或零測試。
   3. 寫最少必要實作使測試 Green。
   4. 執行受影響的驗證後，再進入下一個行為。

8. 處理 Review finding 前確認它仍適用目前程式。行為錯誤先建立能重現問題的失敗測試；純 refactor 保持既有測試 Green，不製造假 Red。
9. 執行專案既有的完整 format、static analysis、build、test、coverage 或其他適用驗證，並如實回報實際命令與結果。
10. 將完成結果交由 `review-implementation` 從 Implementation 與 Test 兩個視角審查。

## Design Limits

- 新增 Runtime、Framework script、狀態保存或新抽象前，必須能指出目前 Spec、既有 Repository 技術棧或驗收條件為什麼需要；否則不新增。
- `codebase-design` 的 Module、Interface、Seam 等詞彙只用於設計推理；程式碼沿用所在語言、Framework 與 domain 的慣用名稱。概念上的 Interface 不要求 Java `interface`。
- 只有確有重大 interface 或 seam 替代方案時才讀取 `codebase-design/DEEPENING.md` 或 `DESIGN-IT-TWICE.md`。
- 不為想像中的替代實作預建 interface、adapter、factory、strategy 或其他擴充點。
- 不為了減少檔案而合併具有不同實際責任的自然分層。
- 純文件或簡單設定變更只做與風險相稱的驗證，不為了形式製造測試。
- 使用 Repository 既有工具鏈，不替 Framework 建立 Node、Python 或其他執行 Runtime。

## Boundaries

- 不暗改 Spec。
- 不執行最終 Review，也不宣告自己的實作已通過 Review。
- 不建立 verification evidence、Review 狀態檔或其他 Framework Runtime 資料。
- Push、PR、CI 與 Merge 由 root `AGENTS.md` 的交付流程負責。
