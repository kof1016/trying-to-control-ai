# Push 前 Review 契約

## 為什麼分成兩次

Implementation Review 問「實作是否正確、安全且符合 Spec」；Test Review 問「測試是否真的能抓到錯誤並覆蓋 Spec」。把兩者混成一段自由文字，容易讓功能看似完成就掩蓋弱測試。本流程要求兩個獨立 verdict，但不強迫建立 issue tracker 或遞迴 subagent。

## 一次性的 Bootstrap profile

遠端 repository、tag ruleset 與第一份產品 Spec 尚未存在時，初次匯入本交接包不能假造 normal point 的 manifest 或 trusted ref。只允許 [`BOOTSTRAP.md`](BOOTSTRAP.md) 的一次性 `bootstrap-local` profile：

- 權威輸入是人類已接受的交接包，落到 baseline commit 後以 `docs/BOOTSTRAP.md @ <bootstrap-authority-sha>` 固定；這不是 A+B Frozen Spec。
- Review 範圍從匯入前的 commit 到最終 bootstrap `HEAD`。全新 repository 沒有前一個 commit 時，以 `git hash-object -t tree /dev/null` 得到的 empty-tree object 作 base，並把 `base_kind` 記為 `empty-tree`；既有 repo 則記為 `commit`。
- 仍要取得乾淨 working tree、Bootstrap full verify 證據、完整 committed diff，以及兩個獨立 verdict；不能因為沒有產品程式碼就略過 Test Review。
- 這個 profile 只涵蓋交接文件、驗證／安裝 scripts、lock、notices 與三個 pinned repo Skills。第一次 Push 完成即退役；A+B、CI workflow、ruleset 或任何後續修改都不能再用它規避 normal point 契約。

Bootstrap Review 的固定 envelope 見下方；它刻意不含 `point_manifest`、`freeze_sha` 或 `trusted_ref`，也不以 `N/A` 假裝它們存在。

## Normal point 的共同輸入與前置條件

兩次 Review 都必須取得：

- Frozen Spec 的 `path @ freeze SHA`。
- Committed point manifest 與其 protected trusted freeze ref。
- base、head 與該 execution profile 的 committed diff，以及必要的完整檔案與相依脈絡。
- Repository 規則與該 execution profile 的驗證結果。
- 目前已知風險、刻意不做項目與可用的 Red → Green 執行證據。

Reviewer 不能只看摘要，也不能把 range 外內容假裝成已 Review。

### Local profile（Push 前）

- base 是 point branch 建立時記錄的 `Point-Base`，head 是本機 `HEAD`；兩者都固定為 SHA。
- diff 是 `git diff <point-base>..HEAD`；前置條件是 working tree 乾淨，且 canonical full local verify 已實際完成。
- point manifest 的 `point_base`、Spec blob 與本機 trusted tag 都要相符。
- 兩份 verdict 都記錄相同的 manifest、base、Frozen Spec、verify evidence 與最終 `HEAD`。任何新 commit 都使兩份舊 verdict 失效。

### GitHub profile（正式重驗）

- base 是 GitHub 提供的 PR merge-base，head 是 event 綁定的 head SHA；不信任 PR body 自稱的任意縮小 range。
- 從 PR diff 找到唯一 `.ai-sdlc/points/<point-id>.json`，驗證 `point_base` 等於 merge-base、protected trusted ref 指向 freeze SHA；Frozen Spec 從 freeze commit 讀取，且 `HEAD` 同路徑 blob 必須一致。
- 證據來自乾淨 runner 的 required checks；本機 PASS 只作補充，不能替代 GitHub 重驗。

Review 是與實作分開的判斷 pass。工具允許時優先使用 fresh context；可用 Codex 內建 review 能力或另一個明確受限的 review session，但不把「必須再開 subagent」寫成遞迴規則。

下列檢查表以 normal point 為主；執行 `bootstrap-local` 時，把其中的 Frozen Spec／acceptance criterion 精確替換為 Bootstrap authority 的 scope、執行順序與完成條件，不能自行補出產品需求。

## Implementation Review

逐項檢查：

1. 每個變更是否能追到 Frozen Spec acceptance criterion，且沒有 scope creep。
2. 正常、錯誤與邊界路徑是否正確；狀態、並行、重試與失敗處理是否符合需求。
3. public interface 與 seam 是否仍是 Spec 已確認的形狀；若形狀需改，這是 Spec change，不是 reviewer 自行改寫。
4. 是否引入回歸、相容性破壞、不安全預設、secret／個資洩漏或依賴風險。
5. 程式是否保持局部可理解、沒有無必要抽象、重複邏輯或未使用路徑。
6. 設定、migration、文件或 observability 是否因實際行為改變而必須同步。

## Test Review

逐項檢查：

1. Frozen Spec 的每個 acceptance criterion、重要錯誤與邊界案例是否有可追溯驗證。
2. 測試是否經由已確認 public seam 觀察行為，而不是 private method、內部 call count 或 side channel。
3. Expected value 是否來自 Spec、worked example 或其他獨立 oracle，而非重算 production algorithm 的 tautology。
4. 測試在合理的錯誤實作下是否會失敗；必要時以安全的暫時變異或針對性實驗驗證敏感度，實驗內容不得留在 commit。
5. Mock 是否只出現在真正外部邊界；自己的 module 優先使用真實實作或合適的 in-memory adapter。
6. 測試是否穩定、可重複、彼此隔離，沒有依賴順序、真實時間、未控制網路或脆弱 snapshot。
7. Coverage 結果是否達到 repository policy，且沒有用高百分比掩蓋關鍵行為缺口。

沒有保留下來的 Red 執行輸出必須標示 unavailable，不能杜撰；Test Review 可用測試敏感度檢查補足信心，但不能把它倒稱為當時已執行的 Red 證據。

## 固定輸出

每次 Review 先輸出固定 result envelope，再列 findings。Envelope 不得省略：

| 欄位 | 要求 |
|---|---|
| `profile` | normal point 使用 `local` 或 `github` |
| `review_type` | `implementation` 或 `test` |
| `point_manifest` | committed manifest path |
| `spec_path`／`freeze_sha`／`trusted_ref` | 與 manifest 及 tag 完全一致 |
| `base_sha`／`head_sha` | 本次實際 Review range 的完整 SHA |
| `verification_evidence` | Local 為實際 command/result record 的 ID 或 digest；GitHub 為 clean-runner check run IDs |
| `findings` | 下列固定 finding objects；無 finding 時為空陣列 |
| `verdict` | `PASS` 或 `BLOCKED` |

一次性 Bootstrap 的 envelope 只使用下列欄位：

| 欄位 | 要求 |
|---|---|
| `profile` | 固定為 `bootstrap-local` |
| `review_type` | `implementation` 或 `test` |
| `bootstrap_authority_path` | 固定為 `docs/BOOTSTRAP.md` |
| `bootstrap_authority_sha` | 包含已接受交接包的 baseline commit 完整 SHA |
| `base_kind`／`base_sha` | `commit` 與匯入前 commit SHA，或 `empty-tree` 與實際 empty-tree object ID |
| `head_sha` | 最終 bootstrap `HEAD` 的完整 SHA |
| `verification_evidence` | 實際 Bootstrap full verify command/result record 的 ID 或 digest |
| `findings` | 同一固定 finding objects；無 finding 時為空陣列 |
| `verdict` | `PASS` 或 `BLOCKED` |

每個 finding 使用同一 schema：

| 欄位 | 要求 |
|---|---|
| ID | `IMP-001` 或 `TST-001` |
| 等級 | `BLOCKING` 或 `ADVISORY` |
| Authority ref | Normal point 填 Spec acceptance criterion／section；Bootstrap 填 `docs/BOOTSTRAP.md` section；無對應時寫 `N/A` 並解釋 |
| Rule ref | 明確 repository rule／policy；無對應時寫 `N/A` 並解釋 |
| 位置 | 檔案與行或最小可定位範圍 |
| 證據 | 可重現的行為、資料流、命令結果或明確反例 |
| 影響 | 對使用者、正確性、安全或可維護性的實際後果 |
| 修正條件 | 可驗證的完成條件，不直接替作者擴充 scope |

`BLOCKING` 必須有可定位、可反駁的證據，且至少符合一項：違反對應 profile 的 authority、違反明確 repository rule、構成可證明的 correctness／security／reliability 問題，或測試無法偵測 authority 所禁止的錯誤。命名、抽象風格或一般重構偏好預設只能是 `ADVISORY`；不能用 reviewer 個人偏好阻擋 Push。`Authority ref` 與 `Rule ref` 不得同時無理由地填 `N/A`。

Verdict 只能是：

- `PASS`：沒有未解決的 `BLOCKING` finding；`ADVISORY` 已明確記錄。
- `BLOCKED`：至少一個 `BLOCKING` finding 尚未修正與重驗。

沒有 finding 時明寫「No findings」，不能只給泛稱的「看起來不錯」。Normal point 的 aggregate gate 先確認兩份 envelope 除 `review_type` 與各自 findings 外，profile、manifest、Spec、trusted ref、base、head 與 verification evidence 完全一致；Bootstrap aggregate 則比較兩份 envelope 的 profile、bootstrap authority、base、head 與 verification evidence。對應 profile 的任一欄缺漏或不一致，或任一 verdict 不是 `PASS`，結果即為 `BLOCKED`。

## Matt `code-review` 不作 gate

Pinned 原版雖然正確地只比較 committed diff，時機已可放在 Green commits 之後，但仍有不可接受的包裝問題：無條件要求 `docs/agents/issue-tracker.md`、強制 reviewer subagents 且有遞迴風險、輸出無固定 schema、沒有 evidence recheck，也沒有獨立 Test Review。因此本版保留「committed range + Standards／Spec」的好概念，不安裝也不假稱原版 Skill 是 Push Gate。
