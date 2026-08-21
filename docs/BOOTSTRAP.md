# Repository Bootstrap

## 範圍

本文件是下一階段由 Codex 執行的操作契約，不是要求使用者逐行貼命令。本交接包只提供文件與腳本，現在沒有建立 A+B、GitHub Actions 或遠端 repository。

## 前置事實

Codex 執行前自行檢查：

- 目標路徑與現存檔案，辨識並保留使用者修改。
- Git 與 Node.js 可用；repo-owned Skill installer 使用 Node.js 原生 HTTPS fetch，要求 Node.js `>=20.0.0`，不執行第三方 installer。
- 本包檔案完整，且 [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) 存在。
- 若要建立遠端，只向使用者確認無法自行判定的 GitHub owner、repo slug，以及 push／建立 public repo 的授權；public visibility 已確定，不再重問 private/public。

## Codex 執行順序

1. 在目標根目錄執行 `node scripts/check-handoff.mjs`。失敗先修文件或 package，不跳過。
2. 若尚非 Git repo，初始化 `main`；若已有 repo，先檢查 status、branch、remote 與歷史，不覆寫或重建。匯入前若有 `HEAD`，把其完整 SHA 記為 Bootstrap base；全新 repo 則以 `git hash-object -t tree /dev/null` 記錄 empty-tree object ID 與 `base_kind: empty-tree`。
3. 以本包文件、script、lock 與 notices 建立第一個本機 baseline commit。commit 前再次執行 handoff check；此 commit 的完整 SHA 是 `bootstrap_authority_sha`，權威路徑固定為 `docs/BOOTSTRAP.md`。
4. 執行 `node scripts/install-skills.mjs`。Script 只安裝 pinned 的三個 repo-scope Skills，不覆寫不相符的同名目錄。
5. 執行 `node scripts/install-skills.mjs --verify`；它以 lock 的逐檔 hash 驗證內容。另用一般 Git diff 檢查待提交 scope，不把 hash lock 當成可供 `--no-index` 比較的目錄。
6. 只提交 `.agents/skills/{grilling,tdd,codebase-design}`，建立獨立本機 Green commit；不要把 npm cache、暫存下載或其他 Skill 納入。
7. 在最終 `HEAD` 連續執行 `node --check scripts/check-handoff.mjs`、`node --check scripts/install-skills.mjs`、`node scripts/check-handoff.mjs`、`node scripts/install-skills.mjs --verify`，形成 Bootstrap 的 full local verify。
8. 依 [`REVIEWS.md`](REVIEWS.md) 的一次性 `bootstrap-local` profile，對 Bootstrap base 到最終 `HEAD` 的完整 committed state 執行 Implementation Review、Test Review。Test Review 要檢查兩支 script 的 success／failure paths、hash／scope 驗證與已執行 smoke evidence，正常輸出 `PASS` 或 `BLOCKED`；不能因為沒有 A+B product code 就略過。這個 profile 不要求也不允許假造 product Spec、point manifest 或 trusted tag。
9. 在取得外部寫入授權後，才建立／連接 public GitHub repo 並 Push。沒有 Actions 前不宣稱 CI 已綠，也不先建立依賴不存在 check 名稱的 ruleset。

## Bootstrap 完成條件

- `AGENTS.md` 仍只是索引，所有 local links 可解析。
- 舊版已在 `README.md` 明確作廢。
- `.agents/skills/` 中三個選定 Skill 通過逐檔 SHA-256；沒有因安裝動作加入其餘 Matt Skills。
- `third_party/matt-pocock-skills.lock.json` 的 source、commit、installer、白名單與安裝內容一致。
- Git working tree 乾淨；baseline 與 Skill install 是可辨識的本機 commits。
- 未執行 `/init`，也沒有要求使用者手動安裝。
- A+B、Actions、ruleset、secrets、Cloud environment 都仍未被偷跑實作。
- 第一次 Push 後 `bootstrap-local` profile 即退役；第一個後續 point 起使用 frozen Spec、manifest、trusted ref 與 normal Review envelope。

## 失敗處理

- Node 版本不足：Codex 說明差異並在已授權環境取得相容 runtime；不叫使用者代跑。
- 既有同名 Skill hash 不同：停止並呈現差異。這可能是使用者修改或不同版本，不自動刪除／覆寫。
- 下載或逐檔 SHA-256 失敗：停止；不改用 `latest`、unpinned branch 或另一份鏡像矇混。
- Git 工作區不乾淨：隔離本包修改或請使用者裁決重疊檔案；不 reset、clean 或 checkout 掉既有工作。
