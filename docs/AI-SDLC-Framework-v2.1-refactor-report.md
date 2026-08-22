# AI-SDLC Framework v2.1 自主重構報告

## 一、結論

本次重構已在 `kof1016/ai-work-flow-demo` 的
`refactor/framework-skill-architecture` 分支完成。實作以 GitHub `main` 的
`06bab4bd26e2f48fa02dad16a29a216086244bbc` 為唯一基準；舊版或帶版號 ZIP
沒有被當成來源。

重構後的 Framework 對使用者只保留「設定、規格、實作、Review、交付」五個白話階段，
並以四個有獨立 AI 判斷責任的第一方 Skill 承接工作。系統沒有另建通用 Workflow DSL，
也沒有保存一長串人工流程狀態；`inspect` 每次直接從 Repository 內現有事實推導下一個合法動作。

Demo 的 A+B 產品行為沒有改動。Framework 安裝、契約、恢復、Review、封裝、Clean-room
與 Maven 回歸驗證均已通過；兩條獨立 Review 線亦無程式或測試阻擋事項。

## 二、稽核基準與範圍

| 項目 | 結果 |
| --- | --- |
| Canonical Repository | `https://github.com/kof1016/ai-work-flow-demo` |
| 基準分支／commit | `main` / `06bab4bd26e2f48fa02dad16a29a216086244bbc` |
| 實作分支 | `refactor/framework-skill-architecture` |
| Frozen Spec | `docs/specs/framework-skill-architecture.md` |
| 主要實作 commit | `a3ba9f733e5c95008f45b9f21c62167b0f6078e9` |
| Framework 版本 | `2.1.0` |
| 稽核日期 | 2026-08-22（Asia/Taipei） |

唯讀稽核包含 Repository 現況、既有規則、歷史 PR #1–#4，以及 Actions runs
`32524618951`、`32525051121`、`32537489944`、`32538059813`。稽核當時沒有 open PR，
也沒有 Branch Protection 或 Required Checks。這些歷史事實只用來理解目前 GitHub 設定與已修正問題，
不以舊 ZIP 回推或覆蓋現行 Repository。

## 三、架構決策

### 3.1 保持簡單的流程模型

`AGENTS.md` 現在只是一個小型 Router：先核對安裝，再執行 `inspect`，然後載入唯一需要的 Skill
或執行固定 Gate。Runtime 只保存可驗證的 Project、Spec freeze、mode、verification 與 review facts；
下一步由這些事實的新鮮度直接算出，不另外維護生命週期狀態機。

第一方 Skill 只有四個：

| Skill | 為何獨立 |
| --- | --- |
| `setup-project` | 需要理解既有專案、實跑檢查並建立可重現設定 |
| `define-requirement` | 需要找出決策缺口、整理並檢查正式 Spec |
| `implement-change` | 需要依 Frozen Spec 做 TDD、設計與實作判斷 |
| `review-change` | 需要分別做 Implementation 與 Test／Workflow 語意 Review |

Push、PR、CI、Merge、模式選擇與單一 Git 指令沒有被拆成 Skill，因為它們是固定動作或 Gate，
沒有獨立的 AI 工作成果。這避免為拆而拆。

### 3.2 靜態程式與執行資料分離

- `.ai-sdlc-framework/`：CLI、contracts、templates、locks 與 adapters。
- `.agents/skills/`：四個第一方 Skills，以及另行安裝的固定版本 Matt Skills。
- `.ai-sdlc/`：Project、Work、Reviews、Evidence 與 migration facts。
- `scripts/`、`test/framework/`：只屬於 source checkout 的維護、封裝與驗證工具。

舊 `.ai-sdlc/WORKFLOW.md` 不再是執行權威；歷史 Specs 留作 audit evidence，但不會被誤認為進行中的工作。

### 3.3 固定控制與 AI 判斷分工

內容判斷仍由 AI 完成；hash、Git ancestry、commit scope、schema、evidence freshness、Review freshness
與交付順序則交由固定程式檢查。Frozen Spec 或 Head 一變，舊證據自然失效。

錯誤恢復不是額外狀態圖，而是重新讀取事實：`setup`、`start`、`freeze`、`mode` 即使在寫檔與 commit
之間中斷，也能安全重試；Spec 不可行時以 `reopen` 清掉下游證據後重新確認。

## 四、GitHub 與信任邊界

GitHub Adapter 必須由交付主機注入受信任 API client 與 evidence identity；Repository 不保存 token，
也不接受呼叫者自行填寫 `ci_passed` 或 `merged` snapshot。

交付時會綁定 canonical `origin`，依序建立 Draft PR、加入 exact evidence、轉 Ready，並在 Merge 前重新查詢
base、Head、Required Checks、review decision、未解 review threads、rulesets、conflicts 與 mergeability。
若 Ready PR 推入新 Head，Adapter 會先轉回 Draft，再以新證據重新 Ready。

只有 GitHub 實際設定為 Required 的檢查會阻擋 Merge；非 Required CI 只觀察、不額外等待。
若 PR test-merge commit 上存在任何 check/status，Required contexts 以該 commit 判斷；完全沒有相關事實時
才回退至 feature Head。尚無法由程式證明的 ruleset 直接 fail closed。

本機 evidence 是供合作式執行環境防止遺漏與過期的控制，不是抵抗任意本機寫入者的密碼學 attestation。
GitHub REST merge 可鎖定預期 Head SHA，但沒有同等的 base SHA 原子 compare-and-swap；這項平台限制沒有被誇大。

## 五、安裝、更新與第三方來源

發行包 `dist/AI-SDLC-FRAMEWORK.zip` 採 allowlist，只包含 Framework runtime、四個第一方 Skills、
安裝器、README、授權與必要設定，不包含 Demo Java 原始碼、Runtime Data、歷史 evidence 或 Matt Skills。

| 項目 | 值 |
| --- | --- |
| 發行包 SHA-256 | `2f35862881f59b6cbed5ee53037d37800d96751870e60cfff3f66b0b8c048780` |
| 安裝 manifest SHA-256 | `cffb00499fcdebdfec52daaf17fc94629e1e590cb7c8257b1d77d831afe3f152` |
| 受管檔案數 | 28 |
| 前置需求 | Node.js 20 以上、Git；安裝 Matt Skills 時需 GitHub HTTPS 或已核對 checkout |

安裝器只改 `AGENTS.md` 的 Framework marker block，保留 block 外原始 bytes，並拒絕覆蓋本機已修改的受管檔案。
更新可從 lock 與 manifest 機械核對。

Matt 的 `grilling`、`tdd`、`codebase-design` 沒有被修改或 Fork。來源固定在 upstream v1.2.3 commit
`6acc160e4e0cd062dbbbd7a1b26ae92855edf07e`，installer 會驗證 lock 中的 commit、tree、檔案與 notice hashes，並保存
`.agents/skills/THIRD_PARTY_NOTICES.md`。已知舊安裝格式可遷移；不明內容不會被靜默覆蓋。

## 六、驗證結果

### 6.1 Framework

| 驗證 | 結果 |
| --- | --- |
| `check-install` | PASS；28 個受管檔案與 manifest 完全相符 |
| Node contract／CLI tests | 37 / 37 PASS |
| JavaScript syntax、JSON parse | PASS |
| `git diff --check` | PASS |
| Clean-room drills | 24 案：22 PASS、1 SIMULATED、1 NOT_RUN |

Clean-room 涵蓋 NEW、ADOPT、Spec-only freeze、三種模式、TDD、完整 verification、兩種 Review、
publish preflight、Spec reopen、crash recovery、Head invalidation、Framework update、LF／CRLF、
新 Session Router recovery、A+B replay 與 Matt installer idempotence。

其中需求 grilling 是離線語意模擬，標記為 `SIMULATED`；需要真實 GitHub credential／PR 的案例標記為
`NOT_RUN`，沒有用假資料宣稱通過。最後一次 clean-room 產生時間為
`2026-08-22T02:42:55.748Z`。

### 6.2 Demo 回歸

`bash ./mvnw --batch-mode --no-transfer-progress verify` 通過：

- Java 25.0.4.1、Spring Boot 4.1.1。
- 29 tests，0 failures、0 errors、0 skipped。
- Spotless Format 30 files、Java 9 files，全部通過。
- JaCoCo gate 通過：instruction 96.92%、branch 75.00%、line 93.75%、complexity 80.65%、
  method 95.24%、class 100%。

Mockito self-attach 僅有未來版本相容性警告，不影響本次結果。

A+B 歷史文件曾把所有含小數點輸入描述成無效，但現行程式接受數值上為整數的 decimal／scientific values，
例如 `1.0`。本次以 GitHub 現行行為為基準，保留產品行為並在 Spec 記錄此歧義，沒有趁 Framework 重構偷改產品契約。

## 七、獨立 Review 與修正

實作後分別進行 Implementation、Test／Workflow 與 Security Review。Test／Workflow 與 Security Review
最終均為 PASS、零 blocking findings；Implementation Review 唯一未完成項是本正式報告，已由本文件關閉。

Review 過程中實際修正的重點包括：

- crash 後 freeze／mode／setup／start 可安全恢復，且只接受正確 base 與 checkpoint 範圍。
- rename、delete、type change 與 NUL-delimited Git status 都納入精確 scope 驗證。
- install marker block 外 bytes 完整保留。
- Matt Skills 以精確 lock、真實 pinned installer 與 notice 驗證，不以模擬 checkout 代替。
- Ready PR 新 Head 的 correction loop、evidence retry idempotence、test-merge Required Checks 與
  merged terminal recovery 都有契約測試。
- Adapter 綁定 canonical origin、分頁查詢 checks／reviews，且未支援 ruleset fail closed。

## 八、已知限制

- Clean-room 的語意 grilling 是明確標記的模擬，不代表真人需求訪談。
- 本機沒有 GitHub credential 的 clean-room live delivery，因此該案例為 `NOT_RUN`；實際 Repository
  交付結果應以本次執行最後回報的 PR／Merge URL 為準。
- 本機 evidence 的防護對象是錯誤順序、遺漏與過期，不是已取得任意 Repository 寫入權的惡意程式。
- GitHub merge 的 Head CAS 不能等同 base CAS；Adapter 以 merge 前即時重查縮小風險，但不宣稱消除平台限制。

## 九、交付判準

本分支只有在工作樹乾淨、Frozen Spec 未變、完整 verification 與兩份 Review 都綁定最新 Head 時才可 Publish。
Push 對此任務是自然的遠端交付手段，不額外觸發或等待非 Required CI；PR 與 Merge 的實際結果由
GitHub 即時事實決定，並在本次自主執行的最終回覆中列出。
