<!-- ai-sdlc-framework:begin -->
## AI-SDLC Framework

- 初次設定或環境尚未完成時，完整讀取 `.ai-sdlc/WORKFLOW.md` 的「初次設定」。
- 每個新需求開始前，完整讀取 `.ai-sdlc/WORKFLOW.md`；先建立 Feature Branch、釐清需求並取得人工 Spec 確認，再詢問監督、委派或全自動模式。
- 一個功能只使用一個 Feature Branch 與一個 Pull Request；Spec、測試、實作與修正都留在同一分支。
- Spec 必須由人確認。本機完整檢查與 Implementation／Test Review 通過後才能 Push。
- PR 或 CI 發現問題時更新原分支與原 PR；任何新 Commit，或預設分支自建立／上次同步後又前進，都必須在同一 Feature Branch 重新整合與驗證。
- Required Checks、Review 與 Merge 條件全部成立後，才能依目前模式 Merge。
- 永遠優先遵守本 Repository 更具體的技術、測試、安全與交付規範。
<!-- ai-sdlc-framework:end -->
