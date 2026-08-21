# 恢復需求拷問與第一次使用引導

狀態：Confirmed

## 目標

修正 Framework 重建後的流程退化，讓 AI 在需求關鍵決策尚未確定時自動使用 `grilling`，並在初始設定完成後使用 README 既有的 `A+B` 範例引導。新需求先由人參與需求釐清與 Spec 確認，確認後才選擇決定後續自動化程度的執行模式，避免讓使用者誤以為委派或全自動模式會代替人決定需求。

## 可驗收條件

- [x] `.ai-sdlc/WORKFLOW.md` 明確規定：收到新需求後，若可觀察行為、範圍、驗收條件、重要邊界／錯誤、風險取捨或 test seam 任一尚未確定，AI 必須在選擇執行模式前自動使用 `grilling`。
- [x] 規則明確區分條件式自動啟用與無條件啟用；需求已完整且可測時，不強制進行冗長的 `grilling`。
- [x] 初始設定完成且尚無產品需求時，AI 的下一步引導必須沿用 README 的 `A+B` 第一次使用範例，只要求使用者先描述需求；不得要求同時選擇執行模式，也不得自行用其他隨機功能取代該範例。
- [x] `A+B` 保持為可選練習，不會因引導文字而自動開始實作。
- [x] 第一次需求提示必須明確說明：目前會先釐清需求並整理 Spec，必要產品決策與最終 Spec 必須由人確認，因此現階段不需要選擇執行模式。
- [x] Spec 確認後的提示必須明確列出監督、委派與全自動模式，說明模式只控制後續實作、驗證、Push、PR 與 Merge 的自動化程度及停止點。
- [x] 每個新需求都只能在 Spec 確認後、開始實作前重新選擇執行模式，不沿用上一個需求，也不接受提前選擇。
- [x] 使用者若在提出需求或 Spec 確認前寫入模式，AI 必須說明目前尚未進入模式選擇階段；該輸入不保留、不生效，Spec 確認後仍須重新詢問。
- [x] Feature Branch 仍在收到新需求並確認工作目錄安全後、開始整理 Spec 前建立，不因模式選擇延後而把 Spec 放到其他分支或預設分支。
- [x] README 與 Workflow 對第一次使用、需求釐清、Spec 確認、模式選擇時機及 `grilling` 觸發條件的描述一致。
- [x] 在定稿 Workflow 與 README 前，先以 `A+B` 作為第一個需求完整試跑新流程；試跑用來發現流程問題，發現需要改變行為時回到本 Spec 更新並重新確認。
- [x] Repository 根目錄加入 `.gitattributes`，以 `* text=auto eol=lf` 將專案文字檔的工作目錄與 Git 儲存格式統一為 LF，二進位檔不做文字轉換。
- [x] 現有受 Git 管理及本次新增的文字檔全部正規化為 LF，不留下 CRLF／LF 混用；只改換行格式，不改檔案內容。
- [x] 不修改系統、全域或 Repository-local 的 `core.autocrlf` 設定；換行政策由可版本控制的 `.gitattributes` 負責。
- [x] LF 正規化後，Windows 上的 Maven Wrapper 仍可透過 `mvnw.cmd --version` 成功啟動。

## 輸入、輸出與公開介面

- 輸入：使用者完成初始設定後詢問下一步，或提出完整／不完整的新需求；使用者也可能在 Spec 確認前誤填模式。
- 輸出：先提示只需描述需求；必要時依決策前沿進行 `grilling`；產生待使用者確認的 Spec；Spec 確認後才要求使用者選擇本需求的執行模式。
- 公開介面：根目錄 `README.md` 與 `.ai-sdlc/WORKFLOW.md` 所定義的 AI 協作行為。

## 提示契約

初始設定完成且尚無產品需求時，第一次需求提示使用以下內容：

```text
請先描述你要完成的功能。

你可以用簡單的 A+B 熟悉完整流程，也可以直接提出真實需求：
需求：<你要完成的功能>

例如：
需求：我要做 A+B 功能

此階段會釐清需求並整理 Spec；必要的產品決策與最終 Spec 必須由你確認，因此目前不需要選擇執行模式。

Spec 確認後，我會再請你選擇監督、委派或全自動模式；模式只決定後續實作、驗證、Push、PR 與 Merge 的自動化程度。
```

Spec 確認後一律使用以下提示：

```text
Spec 已確認。請選擇這個需求後續階段的執行模式：
1. 監督模式：依你的逐階段授權執行；在實作與本機驗證完成、每次 Push／更新 PR，以及 Merge 前停止確認。
2. 委派模式：自動完成實作、驗證、修正、Commit、Push 及建立或更新 PR；Merge 前由你確認。
3. 全自動模式：自動執行相同流程；Required Checks、Review 與 Merge 條件全部成立後自動 Merge。
```

若使用者曾在 Spec 確認前填寫模式，當時應明確說明該選擇不會被保留；不得在 Spec 確認後直接套用或略過上述提示。

## 邊界與錯誤處理

- 使用者只是在討論或更正語音辨識時，不得誤判成啟動產品需求或 `grilling`。
- 使用者在新需求或 Spec 確認前指定模式時，必須告知時機尚未到，且不保存該選擇。
- 不得在需求釐清前要求模式，也不得推定沿用先前模式；Spec 確認後必須重新選擇模式才能開始實作。
- 需求已完整且不需要 `grilling` 時，仍須先產生並由人確認 Spec，再選擇執行模式。
- 建立 Feature Branch 不代表已選擇模式，也不得觸發實作。
- `grilling` 只詢問需要人類決定的事項；可從 Repository 或工具查得的事實由 AI 自行查證。

## 非目標

- 不修改第三方 `grilling` Skill 本身。
- 不讓所有完整、低歧義需求都強制進入多輪訪談。
- 不自動執行 README 的 `A+B` 練習。
- 不改變三種模式在 Spec 確認後的自動化範圍、停止點或 Merge 權限。
- 不允許任何模式跳過人工 Spec 確認。
- 不修改 Java、Spring Boot、測試套件或 GitHub Actions 設定。
- 不修改系統、全域或 Repository-local Git 設定。
- LF 正規化本身不改變檔案內容；除了本功能明確要求的 Workflow、README 與 Spec 文字外，不修改其他文字內容。

## 驗證方式

- Unit Test：不適用；本次為 Framework 文件與提示契約修正，沒有可合理產生 Red 的產品程式行為。
- 其他檢查：先以 `A+B` 完整試跑新流程，再以情境 Review 驗證「未指定模式」、「Spec 前誤填模式」、「需求完整」與「需求需 grilling」四條流程；搜尋並排除仍要求在需求起手時選模式或保留提前模式的舊文字；檢查 Git diff／whitespace，使用 `git check-attr`、`git ls-files --eol` 與位元組檢查確認文字檔均為 LF，並執行 `mvnw.cmd --version` 確認 Windows Maven Wrapper 可啟動。由於 Java 與 Build 設定內容未改變，不重複執行完整 Build。

## A+B 完整試跑結果

- 在 `feature/a-plus-b` 建立正式 [A+B Spec](a-plus-b.md)，將 `grilling` 的 14 組決策整理成可驗收條件、錯誤矩陣、邊界、非目標、驗證方式與決策紀錄；原始問答不是正式 Spec 的替代品。
- 使用者在 Spec 前輸入的委派模式未保留；Spec 由人確認後重新顯示三種模式提示，使用者再選擇全自動模式。
- 全自動階段完成 TDD、完整本機驗證、Implementation Review、Test Review、Commit、Push、Draft PR、CI、Ready 狀態檢查與自動 Merge。A+B 本機 Commit 為 `cf89110`，PR 為 `#3`，Merge Commit 為 `beddd2d`。
- 最終完整驗證為 29 tests、0 failures；Review 額外發現並修正 Spring MVC 對 `OPTIONS` 自動回 `200` 的框架特例，證明 Spec 邊界與獨立 Test Review 能攔截流程中未預見的行為。
- 試跑分支建立自尚未包含本功能 `.gitattributes` 的 `main`，因此新 Java patch 曾先被既有 CRLF Spotless 規則擋下；使用專案 formatter 後測試正常。這確認 LF 政策必須隨本功能正式交付，並非 TDD 行為失敗。
- 試跑沒有發現需要再次改變已確認產品行為的事項；文件只補齊模式時機、正式 Spec 責任與實際執行順序。

## 未決事項

- 無；使用者已確認模式只能在 Spec 確認後選擇、提前模式不保留、Feature Branch 時機、兩段提示內容、先以 `A+B` 完整試跑再整理文件、Repository LF 政策與精簡驗證方式。

---

使用者確認後，將狀態改為 `Confirmed`。如果後續必須改變可觀察行為，先更新本文件並重新確認，再繼續實作。
