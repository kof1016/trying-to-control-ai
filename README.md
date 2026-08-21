# AI-SDLC Framework

AI-SDLC Framework 是一套讓 AI 參與從環境設定、需求到 Pull Request／Merge 的開發交付方式。

它要解決的不是「讓 AI 更快產生程式碼」，而是 AI 寫完之後是否符合需求、能不能通過測試、出了問題怎麼修正，以及人要在哪裡介入。Framework 將這些工作整理成一條可執行、可驗證、可追蹤的流程。

主要作用：

- 開始開發前，先建立能 Build、Test 與檢查品質的本機環境。
- 先把需求整理成可驗收的規格，再開始寫程式。
- 讓 AI 執行 TDD、品質檢查、Review 與必要修正。
- 讓使用者選擇參與程度，並能在過程中隨時介入。
- 透過 GitHub Pull Request 與 CI 留下可以查看的交付紀錄。

## 開發方式

Framework 預設採用簡單的 [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow)：

- `main` 維持可交付狀態。
- 一個功能使用一個 Feature Branch。
- 規格、測試、程式與後續修正都在同一個分支完成。
- 一個功能建立一個 Pull Request。
- Review 或 CI 發現問題時，繼續修改原分支並 Push，原本的 PR 會自動更新。
- 所有檢查通過後，才 Merge 回 `main`。

這是預設方式；既有專案若有自己的分支或交付規則，Framework 會沿用專案規範。

## 本機與 GitHub 的關係

| 階段 | 主要工作 |
| --- | --- |
| 本機 | 需求釐清、TDD、實作、Test、Lint、Build、AI Review 與修正 |
| GitHub | Pull Request、團隊 Review、CI 重驗與最終 Merge |

本機先完成第一次完整驗證；GitHub CI 再於乾淨環境執行相同檢查，確認結果可以重現。GitHub 不是第一次測試或除錯的地方。

## 第一次使用

「導入 Framework」只是把 AI 執行規則與範本放進 Repository；真正需要安裝的是該專案技術棧所需的 Runtime、Build、Test、Lint 或 IDE 工具。

AI 讀取本頁後，必須接著讀取 `.ai-sdlc/WORKFLOW.md`，並依其中規則完成設定。

### 新專案

將 ZIP 內容解壓到空的專案根目錄，從該目錄開啟 Codex，輸入：

```text
請讀取 README.md，依文件完成 AI-SDLC Framework 初始設定。
完成基線驗證後先停止，不要執行範例需求。
```

### 既有專案

將 ZIP 解壓到專案外的暫存資料夾，從既有專案根目錄開啟 Codex，輸入：

```text
請讀取 <Framework 解壓路徑>/README.md，依文件將 AI-SDLC Framework 導入目前專案。
先檢查現況，不要覆寫既有檔案或未提交的修改。
完成基線驗證後先停止，不要開始產品需求。
```

AI 會先判斷目前是新專案還是既有專案。

新專案會先確認專案形態與技術棧，檢查必要的 Runtime、Build Tool 與使用者採用的 IDE／Plugin，再建立適用的 Test、Lint、Format、Build、Coverage 與 GitHub Actions。

既有專案會先閱讀目前的程式、技術棧、測試與 CI 設定，沿用原本的開發方式；缺少必要工具時才提出補充方案，不會為了導入 Framework 任意更換技術棧。

技術棧確認後，AI 可以安裝缺少的專案 Dependency 與 Repository-local Build／Test／Lint 工具。若要安裝 Runtime、系統軟體、IDE／Plugin，修改重要設定、登入服務或取得新權限，AI 會先說明並取得同意後協助完成。初始設定完成後，Framework 會等待第一個需求，不會自動執行示範功能。

## 每個需求先選擇模式

每次開始新需求都要重新選擇模式，不沿用上一個需求；若起手提示未指定，AI 才會先詢問。

| 模式 | 執行方式 |
| --- | --- |
| 監督模式 | AI 分階段執行，在 Spec 確認、本機驗證完成、每次 Push／更新 PR，以及 Merge 前等待使用者確認；適合第一次熟悉流程 |
| 委派模式 | 規格確認後，AI 自動完成實作、驗證、修正、Commit、Push 與建立或更新 PR；由使用者 Merge |
| 全自動模式 | 規格確認後，AI 在已授權範圍內自動執行；選擇此模式也代表本需求通過所有檢查後可自動 Merge |

三種模式使用相同的測試與品質標準，不會因自動化程度不同而省略檢查。

若未在起手提示指定模式，AI 會詢問：

```text
請選擇這個需求的執行模式：
1. 監督模式
2. 委派模式
3. 全自動模式
```

中途若要調整，直接告訴 AI：

```text
切換為監督模式
切換為委派模式
切換為全自動模式
查看目前模式
```

切換會從下一個尚未執行的步驟生效，不會重開分支或重做整個需求。

## 開始一個新需求

可直接複製：

```text
請依 AI-SDLC Framework 開始新需求。

需求：<你要完成的功能>
模式：<監督／委派／全自動>
```

第一次使用時，可以用簡單的 `A+B` 熟悉完整流程：

```text
請依 AI-SDLC Framework 開始新需求。

需求：我要做 A+B 功能
模式：監督
```

`A+B` 只是可選的練習，不會自動執行。它的行為與技術細節會在真正開始需求後，由 AI 和使用者逐步確認。

## 核心步驟

每個功能依序進行：

1. 選擇執行模式，建立 Feature Branch。
2. 釐清需求，在同一分支建立並確認規格。
3. 依規格進行 TDD、實作與本機品質檢查。
4. AI 分別 Review 程式是否符合規格，以及測試是否真的有效。
5. 發現問題時，AI 在原分支修正並重新驗證。
6. 本機通過後 Commit、Push，建立一個 Pull Request。
7. GitHub CI 與 Review 發現問題時，AI 繼續修改同一分支並 Push；原 PR 自動更新。
8. Merge 前若 `main` 自 Feature Branch 建立或上次同步後又更新，先將最新 `main` 合併到 Feature Branch，解決衝突並重跑完整驗證。
9. 最新版本全部通過後，依所選模式 Merge 回 `main`。

整個流程維持一個功能、一個分支、一個 PR。任何程式、規格或分支基準發生變更，相關測試與 Review 都要重新執行。

## Framework 內容

- [AI 執行規則](.ai-sdlc/WORKFLOW.md)：包含初始設定、Feature Branch、TDD、Review、PR、修正與 Merge。
- [Spec 範本](.ai-sdlc/templates/SPEC.md)：在 Feature Branch 內整理可驗收規格。
- [Pull Request 範本](.ai-sdlc/templates/PULL_REQUEST.md)：呈現變更、驗證與 Review 結果。

這些文件主要供 AI 執行。日常使用只需要提出需求並選擇模式。

## 參考資料

- [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow)
- [Keeping a pull request in sync with the base branch](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/keeping-your-pull-request-in-sync-with-the-base-branch)
- [Codex：AGENTS.md](https://developers.openai.com/codex/agent-configuration/agents-md)
- [Codex：Skills](https://developers.openai.com/codex/build-skills)
