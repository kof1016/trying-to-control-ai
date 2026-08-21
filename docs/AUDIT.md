# 舊版稽核與處置

## 結論

舊版不是可修補的基線。它把「程式碼由誰產生」、「代理自動化程度」、「Git 狀態」與「驗證位置」揉成單一 GitHub Action 流程，方向與本次確認的本機優先模型相反。本版採完整重寫；沒有把舊流程換名後繼續使用。

## 已確認的衝突

| 舊版假設或做法 | 問題 | v2.0 處置 |
|---|---|---|
| GitHub Action 是主要實作入口 | 把 CI 當第一個執行與除錯環境，抹掉本機共用 repo | 本機 Codex 為第一入口；GitHub 只作乾淨環境正式重驗 |
| 產碼、自動化、commit、push、verify 是同一條模式 | 四者本來就是獨立維度 | 在 `RULES.md` 分軸，模式只控制 Approval Gates |
| 只在啟動時選一次監督程度 | 工作中遇到風險或需求決策時無法合理切換 | 模式可隨時切換，從下一個待決 gate 生效 |
| Action 直接 TDD、修復、commit、push | 沒有每個本機 Green stage 的證據與 commit 邊界 | 每個 vertical slice 在相關檢查後建立本機 Green commit |
| GitHub failure 是正常開發回饋 | 遠端成為第一個 debugger，迴圈慢且難定位 | point 完成本機 full verify 與雙 Review 後才 Push |
| 故障展示混在正常案例 | 容易把故意漏檢誤認為正常流程 | 只允許明確標示、不可合併的 Gate Drill |
| Spec 可由流程工具直接發布到 tracker | 沒有人類最後確認與 immutable freeze | AI 拷問與起草；人類確認；以專用 commit 凍結 |
| `AGENTS.md` 同時放規則、安裝、tracker 與流程 | 入口膨脹、內容重複且容易失效 | `AGENTS.md` 只保留情境式索引 |
| 使用 `npx skills@latest` 或 `main` 連結 | 安裝結果不可重現 | installer、source commit、白名單與每檔 hash 全部 pinned |
| 固定安裝 6、7 或 12 個 Matt Skills | 數量先於需求，且候選在 pinned commit 已改變 | 實查 35 個，只安裝 3 個 |
| 為 Matt `code-review` 強建 `issue-tracker.md` | tracker 是上游實作偶合，不是本流程需求 | 原版 `code-review` 與 tracker 均排除 |
| public/private repository 尚待決 | 已與「public GitHub Repo」的確認衝突 | 固定為 public；Bootstrap 執行前只再確認名稱與外部授權 |

## 已作廢的具體內容

下列內容不得從 v1 或中途草稿複製回來：

- `GitHub Action: TDD Implementation` 作為正常起點。
- 每一步都 push、讓 GitHub 找第一個錯誤的操作方式。
- `$setup-matt-pocock-skills`、`/init`、使用者手動安裝 Skill。
- `npx skills@latest`、unpinned `main` URL 或宣稱 direct-download 會自動產生可信 lock。
- 固定的 issue tracker、triage labels、domain docs、ADR 或 repair 次數。
- 把 Gate Drill 的故意失敗當正常 PR。

## 本次刻意未決定

以下項目需要 A+B 的真實需求或 repository 建立後的事實，現在決定就是猜測：

- 語言、framework、package manager 與 canonical verify commands。
- coverage threshold、支援矩陣、部署環境與 release policy。
- A+B 的行為、test seams、資料模型與安全邊界。
- GitHub required check 的實際 job 名稱。
- 無人 repair 的最大次數、可修改路徑與模型設定。
