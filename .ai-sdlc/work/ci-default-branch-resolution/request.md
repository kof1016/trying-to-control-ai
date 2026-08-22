# Request

修正 AI-SDLC Framework 在 GitHub Actions pull_request detached checkout 中的 CI 失敗。

實際證據：PR #5 的 `Framework / contract and clean-room` job 在 `check-install` 回覆
`MISSING_DEFAULT_BRANCH`，因 runner 只有 `origin/main`，沒有 local `main`；Maven job 已成功。
修正應讓可信任的 canonical remote-tracking default branch 可供唯讀安裝／驗證流程解析，
並保留會寫入或建立工作時對 named local branch 與精確 base 的嚴格要求。
