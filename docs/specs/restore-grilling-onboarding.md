# 恢復需求拷問與第一次使用引導

狀態：Confirmed

## 目標

修正 Framework 重建後的流程退化，讓 AI 在需求關鍵決策尚未確定時自動使用 `grilling`，並在初始設定完成後使用 README 既有的 `A+B` 範例與模式選擇引導，不再臨時替換範例或誤用上一個需求的模式。

## 可驗收條件

- [x] `.ai-sdlc/WORKFLOW.md` 明確規定：收到新需求並完成模式選擇後，若可觀察行為、範圍、驗收條件、重要邊界／錯誤、風險取捨或 test seam 任一尚未確定，AI 必須自動使用 `grilling`。
- [x] 規則明確區分條件式自動啟用與無條件啟用；需求已完整且可測時，不強制進行冗長的 `grilling`。
- [x] 初始設定完成且尚無產品需求時，AI 的下一步引導必須沿用 README 的 `A+B` 第一次使用範例，並提示需求模式；不得自行用其他隨機功能取代該範例。
- [x] `A+B` 保持為可選練習，不會因引導文字而自動開始實作。
- [x] 每個新需求仍重新選擇監督、委派或全自動模式，不沿用上一個需求；模式選擇完成後才進入該需求的後續流程。
- [x] README 與 Workflow 對第一次使用、模式選擇及 `grilling` 觸發條件的描述一致。
- [x] Repository 根目錄加入 `.gitattributes`，以 `* text=auto eol=lf` 將專案文字檔的工作目錄與 Git 儲存格式統一為 LF，二進位檔不做文字轉換。
- [x] 現有受 Git 管理及本次新增的文字檔全部正規化為 LF，不留下 CRLF／LF 混用；只改換行格式，不改檔案內容。
- [x] 不修改系統、全域或 Repository-local 的 `core.autocrlf` 設定；換行政策由可版本控制的 `.gitattributes` 負責。
- [x] LF 正規化後，Windows 上的 Maven Wrapper 仍可透過 `mvnw.cmd --version` 成功啟動。

## 輸入、輸出與公開介面

- 輸入：使用者完成初始設定後詢問下一步，或提出完整／不完整的新需求。
- 輸出：一致的第一次使用提示；必要時依決策前沿進行 `grilling`；最後產生待使用者確認的 Spec。
- 公開介面：根目錄 `README.md` 與 `.ai-sdlc/WORKFLOW.md` 所定義的 AI 協作行為。

## 邊界與錯誤處理

- 使用者只是在討論或更正語音辨識時，不得誤判成啟動產品需求或 `grilling`。
- 使用者已在新需求中指定模式時，不重複詢問模式。
- 使用者未指定模式時，必須先詢問三種模式，不得推定沿用先前模式。
- `grilling` 只詢問需要人類決定的事項；可從 Repository 或工具查得的事實由 AI 自行查證。

## 非目標

- 不修改第三方 `grilling` Skill 本身。
- 不讓所有完整、低歧義需求都強制進入多輪訪談。
- 不自動執行 README 的 `A+B` 練習。
- 不修改 Java、Spring Boot、測試套件或 GitHub Actions 設定。
- 不修改系統、全域或 Repository-local Git 設定。
- 不修改文字檔內容；除了新增 `.gitattributes`，既有檔案只允許換行格式正規化。

## 驗證方式

- Unit Test：不適用；本次為 Framework 文件與提示契約修正，沒有可合理產生 Red 的產品程式行為。
- 其他檢查：沿用本次已通過的完整 `Maven clean verify`；LF 正規化後檢查 Git diff／whitespace，使用 `git check-attr`、`git ls-files --eol` 與位元組檢查確認文字檔均為 LF，並執行 `mvnw.cmd --version` 確認 Windows Maven Wrapper 可啟動。由於程式與 Build 設定內容未改變，不重複執行完整 Build。

## 未決事項

- 無；使用者已確認 Repository LF 政策與精簡驗證方式。

---

使用者確認後，將狀態改為 `Confirmed`。如果後續必須改變可觀察行為，先更新本文件並重新確認，再繼續實作。