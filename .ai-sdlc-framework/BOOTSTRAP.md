# Bootstrap

Bootstrap 只負責把 Framework 安裝到 Repository；它不依賴尚未載入的 Skill，也不開始產品需求。

前置需求：Node.js 20 以上、Git，以及安裝 Matt Skills 時可讀取 GitHub 的 HTTPS 網路。受控環境也可以使用已在 lock 指定 commit 的 checkout 執行 `install-matt-skills.mjs --checkout <path>`。

```bash
node scripts/install-ai-sdlc.mjs --source <framework-package> --target <repository>
node scripts/install-matt-skills.mjs --target <repository>
```

第一個安裝器只寫 manifest 管理的 Framework 檔案、四個第一方 Skills、`.gitattributes` 與 `AGENTS.md` 標記區塊。第二個安裝器從 lock 固定的上游 commit/tree/file digests 安裝 `tdd`（實作階段必要）以及需求或設計有需要時才載入的 `grilling`、`codebase-design`。既有內容不在標記區塊內時必須保持原樣；已被使用者修改的受管檔案預設拒絕覆寫。

檢查安裝差異後，先建立一個安裝 checkpoint；`setup` 刻意要求乾淨、已提交的專案基線：

```bash
git add -- AGENTS.md .gitattributes .ai-sdlc-framework \
  .agents/skills/setup-project .agents/skills/define-requirement \
  .agents/skills/implement-change .agents/skills/review-change \
  .agents/skills/tdd .agents/skills/grilling .agents/skills/codebase-design \
  .agents/skills/THIRD_PARTY_NOTICES.md \
  .ai-sdlc/.gitignore .ai-sdlc/framework.lock.json
git commit -m "chore: install AI-SDLC Framework"
```

建立 checkpoint 後重新開啟 Codex Session，從目標 Repository 執行：

```bash
node .ai-sdlc-framework/bin/ai-sdlc.mjs check-install
node .ai-sdlc-framework/bin/ai-sdlc.mjs inspect
```

`inspect` 只根據 Repository 中的事實回傳下一個合法動作。

GitHub 交付需要持有憑證的平台主機注入受信任 API capability；安裝器不保存 token，也不接受本機 JSON 冒充遠端結果。介面與最小 binding 範例見 `GITHUB-ADAPTER.md`。

安全假設與 local evidence／GitHub 原子性邊界見 `TRUST-MODEL.md`。
