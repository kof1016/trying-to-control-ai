# ci-default-branch-resolution

## 目標

讓 AI-SDLC Framework 的唯讀安裝／Project facts 驗證能在 GitHub Actions
`pull_request` 的 detached checkout 正常解析預設分支。當 local `main` 不存在、但 canonical
`refs/remotes/origin/main` 存在時，`check-install` 應使用 remote-tracking ref 驗證 setup baseline，
不再誤報 `MISSING_DEFAULT_BRANCH`。

## 可驗收條件

- [ ] 在 named branch 且 local default branch 存在時，`check-install` 維持現有成功行為。
- [ ] 在 detached HEAD、local default branch 不存在、`refs/remotes/origin/{defaultBranch}` 存在時，
      `check-install` 成功並照常驗證 Framework install lock、managed files、Matt Skills 與 Project baseline。
- [ ] Project setup baseline 必須是所解析 default branch ref 的 ancestor；不符時仍 fail closed。
- [ ] local 與 `origin` remote-tracking default branch 都不存在時，仍回覆明確的
      `MISSING_DEFAULT_BRANCH`，不得 fallback 到目前 detached HEAD 或只信任 `project.json`。
- [ ] 會建立或修改 AI-SDLC 工作的流程仍要求 named local branch 與既有精確 base gate；本修正不得讓
      detached CI checkout 可以執行 `start`、freeze、mode、verify、review 或 delivery mutation。
- [ ] GitHub Actions 的 `Framework / contract and clean-room` job 能通過原本失敗的
      `Verify Framework installation` step，並繼續執行 Framework tests 與 clean-room drills。

## 邊界與錯誤

- Remote fallback 僅接受固定名稱 `refs/remotes/origin/{defaultBranch}`，不搜尋任意 remote，避免來源不明確。
- Branch name 仍須先通過 `git check-ref-format --branch`；不得由設定值組出不安全 ref。
- Local default branch 存在時維持既有解析優先序；只有 local ref 缺失才使用 canonical origin tracking ref。
- 缺少兩種 ref 或 baseline ancestry 不成立時，錯誤必須可辨識且不得靜默降級。

## 非目標

- 不修改 Java A+B 產品行為、Maven 設定或測試。
- 不修改 Branch Protection、Required Checks、GitHub token permissions 或其他 Repository Settings。
- 不以 workflow step 臨時建立 local `main` 作為永久 workaround。
- 不處理 `actions/checkout` 初始化空 Repository 時 Git 自身顯示的 default-branch hint；該提示不是造成
  Framework job 失敗的根因。
- 不改變 default remote 名稱，不支援任意 remote 自動猜測。

## 驗證方式

- 先新增會重現 PR #5 `MISSING_DEFAULT_BRANCH` 的 contract test，確認修正前失敗、修正後成功。
- 新增 local／origin default refs 都缺少時仍 fail-closed 的反向測試。
- 執行全部 Framework contract／CLI tests、clean-room drills 與 `check-install`。
- 執行 Maven `verify`，確認 A+B Demo 與 formatting／coverage 無回歸。
- 執行 package allowlist build、JavaScript syntax／JSON parse 與 `git diff --check`。

## 未決事項

無。
