# AI-SDLC Framework

AI-SDLC Framework 讓 AI 依可查證的 Repository 事實完成需求、測試、Review 與 GitHub 交付。它不保存一長串流程狀態，也不要求 Agent 記住整段對話；每次只用 `inspect` 判斷下一個合法動作。

## 五個階段

| 階段 | 結果 |
| --- | --- |
| 設定 | 專案有實際跑過、可重現的本機檢查；既有 CI 設定保持相容 |
| 規格 | 人工確認的 Spec 以 Spec-only commit Freeze |
| 實作 | 依 Frozen Spec 進行 TDD 與完整本機驗證 |
| Review | Implementation 與 Test Review 分開通過 |
| 交付 | 同一分支與 PR 經本機證據、Review 與實際 Required Checks 後 Merge |

Framework 只保存必要事實：Frozen Spec 的 commit 與 hash、執行模式、驗證所對應的 Head，以及兩份 Review。Spec 或 Head 一變，舊證據自然失效。

## 安裝

發行包名稱為 `AI-SDLC-FRAMEWORK.zip`。解壓後從發行包執行：

前置需求是 Node.js 20 以上與 Git；安裝 Matt Skills 時還需要能以 HTTPS 讀取 GitHub，或由維運端提供已核對的 pinned checkout。

```bash
node scripts/install-ai-sdlc.mjs --source . --target <repository>
```

檢查差異並提交安裝 checkpoint 後再執行第一次設定；`setup` 不會把未提交的安裝檔或其他修改偷偷收進專案基線。精確路徑與指令見 [BOOTSTRAP.md](.ai-sdlc-framework/BOOTSTRAP.md)。

安裝器會：

- 安裝 `.ai-sdlc-framework/` 固定程式與四個第一方 Skills。
- 只更新 `AGENTS.md` 的 AI-SDLC 標記區塊，保留其他內容。
- 寫入 `.ai-sdlc/framework.lock.json`，讓來源、版本與安裝副本可核對。
- 拒絕覆蓋已被本機修改的受管檔案。

Matt Skills 不包含在 Framework ZIP。`tdd` 是進入實作階段前的必要安裝；同一固定套件中的 `grilling`、`codebase-design` 只在需求或設計確有需要時載入：

```bash
node scripts/install-matt-skills.mjs --target <repository>
```

來源、commit、tree、檔案與 notice SHA-256 記錄在 `.ai-sdlc-framework/locks/matt-skills.lock.json`；安裝器會把授權聲明一併保存為 `.agents/skills/THIRD_PARTY_NOTICES.md`。發行來源的同一份聲明見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

詳細的 chicken-and-egg 安裝說明見 [BOOTSTRAP.md](.ai-sdlc-framework/BOOTSTRAP.md)。

## 第一次設定

重新開啟 Codex Session 後，從目標 Repository 輸入：

```text
請依 AGENTS.md 完成 AI-SDLC 專案設定；完成後先停止，不要開始範例需求。
```

Router 會先執行：

```bash
node .ai-sdlc-framework/bin/ai-sdlc.mjs check-install
node .ai-sdlc-framework/bin/ai-sdlc.mjs inspect
```

`inspect` 回傳 `setup-project` 時，AI 會讀取既有技術棧與規則，建立 `.ai-sdlc/project.json`。驗證命令使用 argv array 保存，不經 shell 字串重新解讀。

## 開始需求

只要描述需求：

```text
請依 AI-SDLC 開始新工作。
需求：<要完成的功能>
```

AI 會建立 feature branch 與 `.ai-sdlc/work/<id>/`：

- `request.md` 保存原始需求。
- `spec.md` 是唯一正式 Spec。
- `work.json` 保存 branch、base、確認來源、Freeze 與模式；不保存流程狀態。

需求仍有產品決策時，`define-requirement` 會使用 `grilling` 訪談，再自行整理正式 Spec。`grilling` 的輸出不是 Spec 文件。

## Spec Freeze 與模式

人確認目前 Spec 後，Framework 建立只包含 `spec.md` 的本機 commit。確認來源與 Spec SHA-256 會寫入 commit trailers；`work.json` 再保存 Freeze 事實。

Freeze 後可選擇 Push feature branch 作遠端備份。這個 Push：

- 不開 PR。
- 不要求 CI。
- 不代表 Publish 或允許 Merge。

接著選擇模式：

| 模式 | 自動化邊界 |
| --- | --- |
| `supervised` | 外部寫入與交付動作前等待確認 |
| `delegated` | 自動完成實作、驗證、Push、PR；Merge 前確認 |
| `autonomous` | 所有檢查成立後可自動 Merge |

三種模式只改變停下取得授權的時點，不改變本機驗證、Review 或平台實際 Required Checks／Merge 標準；沒有被設為 Required 的 CI 不是人為前置條件。

## 實作與 Review

`implement-change` 以 Frozen Spec 為唯讀輸入，使用 `tdd` 完成 Red／Green。完整檢查由 `project.json` 的固定命令執行，證據綁定 exact base、Head、Spec hash 與 Framework lock。

`review-change` 分開產生：

- Implementation Review：行為、範圍、錯誤處理、風險與可維護性。
- Test Review：驗收條件、邊界、失敗敏感度、assertion 與 coverage 的實際意義。

任一 Review 阻擋時回到實作；新 commit 會使舊驗證與兩份 Review 一起失效。

實作期間必須改變 Spec 時，使用 `reopen` 保存原因、清除 Freeze／模式並重新確認，不直接修改 Frozen Spec 後繼續。

## GitHub 交付

本機 `preflight` 只在以下事實都成立時允許 Publish：

- 工作樹乾淨，最新 base 已在 verified Head 祖先鏈中。
- Frozen Spec 未改變。
- 完整驗證對目前 Head 通過。
- Implementation 與 Test Review 都對目前 Head 通過。

GitHub Adapter 由交付主機注入受信任的 GitHub API client 與 evidence identity；Repository 不保存 token 或可由呼叫者填寫的 snapshot。Adapter 即時查詢 exact base branch/SHA、Head、Draft／Ready、實際 Required status checks（含 rulesets 與 legacy statuses）、review decision／threads、conflicts 與 mergeability；遇到尚未機械驗證的 ruleset gate 直接拒絕，不接受 Agent 自行填寫的 `ci_passed`／`merged` 檔案。

Push 後，Adapter 為目前 Head 加上由指定 identity 撰寫、內容完全相符的 evidence comment，再將 Draft 轉 Ready。Ready PR 若推送新 Head，會先轉回 Draft，再加入新 Head 的 evidence 並重新 Ready；已存在的 exact comment 可安全重試。Merge 入口會立即重查 live facts，包含 GitHub 用於 Required Checks 的 PR test-merge commit；只有平台實際 Required Checks 會作遠端 check gate。

Host binding 的最小介面、呼叫順序與信任邊界見 [GITHUB-ADAPTER.md](.ai-sdlc-framework/GITHUB-ADAPTER.md)。

Framework 防止遵規 Agent 因遺漏、過期事實或錯誤順序跳關；它不把具有任意 Repository 寫入權的惡意行程變成可信執行環境。完整假設與 GitHub 的原子性限制見 [TRUST-MODEL.md](.ai-sdlc-framework/TRUST-MODEL.md)。

## Source Repository 結構

以下是完整 source checkout；runtime ZIP 只帶安裝與執行所需的 allowlist，不帶維護測試或 Demo 原始碼。

```text
AGENTS.md                         # 精簡 Router
.agents/skills/                   # 第一方與固定版本外部 Skills
.ai-sdlc-framework/               # 靜態 CLI、contracts、templates、lock
.ai-sdlc/                         # Project、Work 與本機 evidence
scripts/                          # 安裝、封裝、Clean-room
test/framework/                   # Framework contract tests
```

`.ai-sdlc/` 不放大型 Agent 說明、Skill、schema 或流程引擎。

## Framework 維護（僅 source checkout）

這些命令不屬於 runtime ZIP；請從 [GitHub source repository](https://github.com/kof1016/ai-work-flow-demo) 執行：

```bash
node scripts/build-framework-package.mjs
node --test test/framework/*.test.mjs
node scripts/clean-room.mjs
bash ./mvnw --batch-mode --no-transfer-progress verify
```

封裝採 allowlist，只包含 Framework 靜態檔、四個第一方 Skills、安裝器、README、授權與行尾規則；不包含 Demo Java 程式、Runtime Data、歷史 Spec 或 Matt Skills。

本 Repository 同時保留 Spring Boot Demo，作為 Git history、PR、CI 與回歸驗證證據。正式重構報告見 [GitHub source repository](https://github.com/kof1016/ai-work-flow-demo/blob/main/docs/AI-SDLC-Framework-v2.1-refactor-report.md)。
