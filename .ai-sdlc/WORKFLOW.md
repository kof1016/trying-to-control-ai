# AI-SDLC Framework 執行規則

本文件供 AI 開發工具執行。使用者只需要閱讀根目錄的 `README.md`。

Framework 預設採用 GitHub Flow：一個功能、一個 Feature Branch、一個 Pull Request。既有專案若有明確規範，沿用既有規範。

## 不可省略的原則

- 初次導入時先完成專案與本機環境設定，再開始任何產品需求。
- 每個新需求都在人工確認 Spec 後、開始實作前重新選擇監督、委派或全自動模式；不沿用上一個需求，也不接受提前選擇。
- 需求規格必須由人確認；AI 不得自行決定未確認的產品行為。
- 規格、測試、實作及修正都留在同一個 Feature Branch。
- 本機 Test、Lint、Build 與 AI Review 通過後才可 Push。
- 一個功能只建立一個 PR；後續修正繼續 Push 到原分支。
- Feature Branch 或預設分支的相關內容改變後，舊的測試與 Review 結果不得直接沿用。
- Required Checks 未通過、仍有未解決 Review，或分支無法安全合併時，不得 Merge。
- 不覆寫使用者未提交的修改，不為了導入 Framework 任意更換既有技術棧。
- 系統級安裝、新權限、登入、付費操作與需求變更仍須由人確認。

## 1. 初次設定

初次設定只建立可開發、可驗證、可在 GitHub 交付的基線，不執行 `A+B` 或其他產品需求。

### 1.1 導入 Framework

1. 讀取根目錄 `README.md` 與本文件。
2. 若 Framework ZIP 位於專案外，將 `.ai-sdlc/` 複製到目標 Repository；若目標已有同名內容，先比較並詢問，不得直接覆寫。
3. 依 [AGENTS block 範本](templates/AGENTS.block.md)：
   - 沒有根 `AGENTS.md` 時建立。
   - 已有 `AGENTS.md` 時保留原內容，只加入 AI-SDLC 區塊。
   - 已有相同標記區塊時，只更新該區塊，不重複加入。
4. 檢查 Git status、目前分支、Remote 與既有專案檔案。

### 1.2 判斷新專案或既有專案

- 沒有可沿用的產品程式、Build 設定或技術棧時，視為新專案；只有 `.git` 不代表已有可沿用的 codebase。
- 已有產品程式或 Build 設定時，視為既有專案。
- 現況與使用者明確說法不一致、或可能影響既有工作時，只詢問必要的判斷，不自行刪除或重設。

### 1.3 新專案

先確認會影響專案骨架的項目：

- 產品形態，例如 API、Web、CLI、Library 或其他公開介面。
- 已指定的語言、Framework、Runtime 版本與 Build Tool。
- 若使用者尚未決定，提出少量適合選項、推薦與取捨，等待確認後再建立專案。

技術方案確認後：

1. 檢查 OS、CPU 架構、Git、Runtime、Build Tool、IDE 與必要權限。
2. 目錄尚未建立 Git Repository 時執行 `git init`，建立 `main` 或使用者指定的預設分支。
3. 優先使用 Project-local wrapper、Dependency 與 Lockfile，讓其他電腦與 CI 可以重現。
4. 建立或設定 Format Check、Lint／Static Analysis、Build、Unit Test 與 Coverage。
5. 有適用且專案需要的 Dependency／Security Check 時一併設定。
6. 建立專案原生的 Run、Test 與驗證命令。
7. 保留 Framework 首頁 `README.md`；將日常開發與驗證命令寫進 `CONTRIBUTING.md`、`DEVELOPMENT.md` 或專案既有開發文件。
8. 建立可驗證的初始 Commit。尚無 Remote 時，先詢問要建立或連接哪個 GitHub Repository，再進行 PR／CI 遠端驗證。

沒有產品程式時，可以驗證環境、依賴解析、Format、Lint 與 Build Smoke；不得把「沒有任何測試被執行」宣稱為 Unit Test 通過。

### 1.4 既有專案

先讀取並沿用：

- 根 `README.md`、`AGENTS.md`、`CONTRIBUTING.md`。
- Build／Dependency 設定檔、wrapper、lockfile 與 workspace 結構。
- 現有 Format、Lint、Build、Test、Coverage 與 CI 設定。
- 分支規則、PR template、Remote、目前分支與未提交修改。

只在必要時補充缺少的設定：

- 不更換語言、Framework、Build Tool 或目錄結構，除非使用者明確同意。
- 不修改無關功能，不自動修復既有專案的歷史問題。
- 既有檢查失敗時，分清是原本就存在或由本次設定造成，讓使用者選擇先修復、暫停導入，或依專案規範把確實非必要的檢查改列為非 Required；不得把失敗宣稱為通過。
- 現有 PR／CI／分支策略優先；Framework 的 GitHub Flow 只是預設值。

### 1.5 本機工具與 Skills

- Project dependency、wrapper 與 repo-local 工具可在已確認技術棧後由 AI 安裝。
- 安裝或移除 Runtime、IDE、IDE Plugin、System Package，使用管理員權限、修改 PATH 或登入私人 Registry 前，必須先取得使用者同意。
- IntelliJ 或其他 IDE 可以提供操作入口，但不能成為唯一的 Build、Test 或 Lint 方式；CI 必須能從命令列執行相同檢查。
- 第三方 Skills 不放在 Framework ZIP。需要時依本文件的「Skills」章節從官方來源安裝。

### 1.6 GitHub 與 CI

技術棧確認後才建立 CI，不能預放與技術棧無關的通用 Workflow。

1. 檢查 GitHub Remote、`gh` 登入狀態及實際權限；缺少時明確要求使用者授權。
2. 建立或整合 `.github/workflows/`，在 Pull Request 與預設分支更新時呼叫和本機相同的 Format、Lint、Build、Test、Coverage 等命令。
3. 若專案已有 CI，整合現有 Workflow，不平行建立另一套互相矛盾的命令。
4. 若專案需要 GitHub 端 AI Review，只有在認證、權限與 Workflow 真正設定並成功執行後，才能宣稱已啟用；否則使用本機 AI Review 與 GitHub 的人工 Review／確定性 CI。
5. Branch Protection、Required Checks 或 Repository 設定只有在具備權限且實際完成後才能回報成功。
6. 將 [Pull Request 範本](templates/PULL_REQUEST.md) 建立或整合到 GitHub 可辨識的 `.github/pull_request_template.md`，並保留既有專案需要的欄位。

CI 設定完成後，實際執行一次本機基線。若可安全 Push，再以專案慣例驗證 GitHub Workflow；尚未在 GitHub 執行過時，必須明確說明，不得把「已產生 YAML」當成 CI 已通過。

### 1.7 初次設定完成

完成條件：

- 根 `AGENTS.md` 已能將 AI 導向本文件。
- 專案技術棧與本機環境已確認。
- 可從命令列執行必要的 Build 與品質檢查。
- GitHub CI 已依實際技術棧建立或整合；尚需權限或遠端驗證的項目已清楚列出。
- 設定變更已依專案慣例 Review。全新空 Repository 可在預設分支建立初始 Commit；既有專案通常使用一個 `chore/ai-sdlc-setup` Branch／PR，或沿用既有規則。

初始設定需要 Commit、Push 或建立 Setup PR 時，先取得使用者確認。若使用 Setup PR，先完成並 Merge 該 PR，再從最新預設分支開始功能需求。

如果初次提示沒有產品需求，完成後停止並等待使用者提出需求；即使 README 提供 `A+B` 範例，也不得自動開始。如果初次提示已包含真實需求，先保存需求內容，完成上述設定交付後再進入下列「開始新需求」。初次提示即使同時包含模式，也不得提前保存或套用；Spec 確認後仍須重新詢問。

初始設定完成且尚無產品需求時，下一步引導必須沿用 README 的第一次使用說明，不得臨時以待辦清單或其他隨機功能取代 `A+B`。使用以下提示；這段文字只提供選項，不代表自動開始範例需求：

```text
請先描述你要完成的功能。

你可以用簡單的 A+B 熟悉完整流程，也可以直接提出真實需求：
需求：<你要完成的功能>

例如：
需求：我要做 A+B 功能

此階段會釐清需求並整理 Spec；必要的產品決策與最終 Spec 必須由你確認，因此目前不需要選擇執行模式。

Spec 確認後，我會再請你選擇監督、委派或全自動模式；模式只決定後續實作、驗證、Push、PR 與 Merge 的自動化程度。
```

## 2. 開始新需求

### 2.1 固定起手步驟：建立 Feature Branch

每個新需求都是新的執行流程。此階段只確認需求身分與分支安全，不詢問或推定執行模式：

1. 確認工作目錄與目前變更，不覆寫無關 WIP。
2. 取得最新的預設分支；預設為 `main`，既有專案依實際設定。
3. 依專案命名規則建立一個 Feature Branch；沒有規範時使用 `feature/<short-slug>`。
4. 若同一需求已有 Feature Branch 或 PR，繼續使用原本的，不另開新的。

若使用者在提出需求或 Spec 確認前填寫模式，立即說明目前尚未進入模式選擇階段；該輸入不保留、不生效。建立 Feature Branch 不代表已選擇模式，也不得觸發實作。

### 2.2 釐清並確認 Spec

1. 先讀取現有程式、專案規則與相鄰功能。
2. 若可觀察行為、範圍、驗收條件、重要邊界／錯誤、風險取捨或 test seam 任一尚未確定，自動使用 `grilling`，依決策前沿分輪詢問並附推薦與取捨；不要求使用者另外指定 Skill。
3. 需求已完整、一致且可測時，不強制進行冗長的 `grilling`；直接整理 Spec。討論、語音辨識更正或針對既有規則的提問，不得只因出現 `grilling` 字樣就誤判為正式需求或啟動訪談。
4. 只詢問會改變可觀察行為、範圍、錯誤處理、風險或測試方式的決策；可從 Repository、工具或可信來源查得的事實由 AI 自行查證。
5. `grilling` 的問題與答案是規格輸入，不是正式 Spec 本身。AI 必須把已確認決策整理成一份完整、可 Review、可版本控制的 Spec；可加入決策紀錄，但不要求逐字保存整段訪談。
6. 使用專案既有 Spec 位置；沒有慣例時，從 [Spec 範本](templates/SPEC.md) 建立 `docs/specs/<feature>.md`。
7. Spec 至少寫清楚目標、可驗收條件、重要邊界／錯誤、非目標與驗證方式。
8. 先做 Spec Review，確認內容一致且可測試，再請使用者確認。
9. Spec 與後續程式留在同一個 Feature Branch，不另外建立 Spec Branch 或 Spec PR。
10. 若實作期間必須改變產品行為，更新同一份 Spec、說明影響並重新取得確認，再繼續。

### 2.3 Spec 確認後選擇模式

Spec 必須先由人確認。確認後、開始實作前，一律重新詢問，不沿用上一個需求，也不套用 Spec 確認前曾輸入的模式：

```text
Spec 已確認。請選擇這個需求後續階段的執行模式：
1. 監督模式：依你的逐階段授權執行；在實作與本機驗證完成、每次 Push／更新 PR，以及 Merge 前停止確認。
2. 委派模式：自動完成實作、驗證、修正、Commit、Push 及建立或更新 PR；Merge 前由你確認。
3. 全自動模式：自動執行相同流程；Required Checks、Review 與 Merge 條件全部成立後自動 Merge。
```

模式只控制 Spec 確認後的自動化程度：

| 模式 | AI 可自動執行 | 固定停止點 |
| --- | --- | --- |
| 監督模式 | 依使用者逐階段授權執行 | 實作與本機驗證完成、每次 Push／更新 PR，以及 Merge 前等待確認 |
| 委派模式 | 自動實作、驗證、修正、Commit、Push、建立與更新 PR | Merge 前等待使用者 |
| 全自動模式 | 在已授權範圍內自動執行同一流程 | 沒有一般停止點；全部檢查通過後自動 Merge |

三種模式都必須執行相同的 Test、Review 與 CI，也都不能跳過人工 Spec 確認。需求歧義、需要改變 Spec、系統安裝、新權限或無法安全判斷時，任何模式都必須詢問使用者。

使用者在這個階段指定 `全自動模式`，即代表目前需求已授權在所有條件成立後自動 Merge，不需要再取得一次 Merge 確認；Repository 權限與保護規則仍須遵守。

### 2.4 中途切換

本需求完成初次模式選擇後，使用者可直接說：

```text
切換為監督模式
切換為委派模式
切換為全自動模式
查看目前模式
```

切換從下一個尚未執行的動作生效，不建立新分支、不重做需求，也不取消已完成的有效工作。AI 應回覆目前模式、Feature Branch、下一步與下一個停止點。Spec 確認前的模式文字不是中途切換，仍依 2.1 視為不生效。

## 3. 同一分支內完成需求

### 3.1 TDD 與實作

每個可獨立驗收的行為依序執行：

1. 先寫一個會因功能尚未存在而失敗的測試。
2. 實際執行並確認是正確原因的 Red，不是語法、環境、Fixture 或零測試問題。
3. 寫足以讓測試通過的最小實作。
4. 執行到 Green，再做不改變行為的必要整理。
5. 執行受影響的 Format、Lint、Build 與 Test。
6. 只提交 Green 狀態；不要為了留下過程而提交已知失敗的普通 Commit。

若需求是純文件、設定或無法合理產生 Red 的機械變更，清楚說明原因並使用適合的驗證方式，不偽造 TDD 證據。

### 3.2 本機完整驗證與 AI Review

功能完成後：

1. 執行專案全部適用的 Format Check、Lint／Static Analysis、Build、Unit Test、Coverage 與其他 Required Checks。
2. 對 Feature Branch 相對預設分支的完整變更做 Implementation Review：程式是否符合已確認 Spec、是否漏做、越界或引入明確風險。
3. 分開做 Test Review：確認測試實際執行受測程式、涵蓋驗收條件與重要邊界，並會在行為錯誤時失敗；不得只驗證 Mock 互動或複製實作邏輯。
4. Review 是三種責任：Spec、Implementation、Test；不要求固定 Agent 數量。

Review 或檢查發現問題時：

- AI 在同一 Feature Branch 修正，不建立 Repair Branch 或新 PR。
- 不修改已確認需求來配合錯誤實作，不刪除或弱化有效測試。
- 重新執行受影響檢查，再重跑完整本機驗證與兩種 Review。
- 問題需要改 Spec、新權限、重大架構決定，或重複修正仍無法安全解決時，停止並請使用者介入。
- 同一問題連續三個修正循環仍未通過時，停止、整理已嘗試內容與失敗證據，請使用者介入。

只有最新 Commit 的本機檢查與 Review 全部通過，才可進入 Push／PR。

## 4. Push、Pull Request 與修正

### 4.1 建立一個 PR

依模式取得必要授權後：

1. Commit 最新 Green 狀態並 Push Feature Branch。
2. 尚無 PR 時建立一個；已有 PR 時更新原 PR。
3. PR 說明至少包含：Spec 連結、變更摘要、實際執行的本機命令與結果、Implementation／Test Review 結論，以及重要修正。
4. 不另外建立一套證據系統；Git Commit、PR、CI 與 Review 紀錄就是可追蹤證據。

### 4.2 PR Review 或 CI 發現問題

- CI／測試失敗先在本機重現；Review 意見先確認問題與影響，再於本機修改並驗證。
- 在原 Feature Branch 修正、Commit 並 Push。
- 原 PR 自動更新並重新執行 CI；依 Repository 規則重新請求必要的人工 Review。只有已設定的 GitHub AI Review 才能宣稱會自動重跑。
- 監督模式在每個主要修正與 Push 前詢問；委派與全自動模式在已確認 Spec 範圍內可以自動修正並更新原 PR。
- 任何新 Commit 都使舊的本機與 GitHub 驗證結果失效，必須以最新 PR Head 為準。

## 5. 同步最新預設分支與 Merge

Merge 前先取得最新預設分支。若預設分支自 Feature Branch 建立或上次同步後又有新 Commit，將最新預設分支合併到 Feature Branch；不在 GitHub 網頁上直接把未驗證的結果合併進預設分支。

沒有既有專案規範時，預設採用 Merge 方式更新 Feature Branch，不 Rebase 或 Force Push 改寫已公開歷史。

更新後：

1. 在 Feature Branch 解決衝突。
2. 重新執行完整本機檢查、Implementation Review 與 Test Review。
3. Commit 並 Push 到同一個 Feature Branch。
4. 等待同一個 PR 的 CI 以最新 Commit 重跑，並依 Repository 規則重新取得必要 Review。

只有同時符合下列條件才可 Merge：

- 最新 PR Head 的 Required Checks 全部通過。
- 沒有尚未處理的 Change Request 或衝突。
- Spec、程式、測試與 PR 說明一致。
- Repository 判定可以合併。

監督與委派模式由使用者 Merge；全自動模式在上述條件全部成立時自動 Merge。Merge 方法沿用 Repository 設定，不由 Framework 強制指定。

## 6. Skills

Skills 只提供局部方法，不接管外層開發流程。

- 符合「2.2 釐清並確認 Spec」的未決條件時必須自動使用 `grilling`；需求已完整且可測時不強制啟用。
- 進行 Red／Green 實作時可使用 `tdd`。
- 確實遇到介面或模組邊界問題時才使用 `codebase-design`。
- Review 依本文件與專案規範執行，不為了數量強制啟動多個 Agent 或另一套完整 Workflow。

Framework 不內嵌第三方 Skill。初次設定時依 [Matt Pocock Skills 官方說明](https://github.com/mattpocock/skills) 與目前可用的官方安裝方式，將需要的 Skills 安裝到 Repository scope，並保留安裝工具產生的版本紀錄。若官方名稱、相依性或安裝方式已改變，先查官方來源並說明影響，不沿用失效指令。
