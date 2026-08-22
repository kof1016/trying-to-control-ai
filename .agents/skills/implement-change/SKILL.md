---
name: implement-change
description: "依已凍結的 Spec 實作或修正一項軟體變更，使用 vertical-slice TDD 並完成目前 commit 的本機驗證。當 inspect 指出可以實作、需要驗證，或 Review／CI 問題需要修正時使用。"
---

# Implement Change

## 邊界

- **何時使用：** 只在 `inspect.nextAction` 指向實作、修正或本機驗證時使用。
- **需要：** `inspect` 指定的 `request.md`、已凍結 `spec.md`、`work.json`、專案驗證命令，以及仍成立的 findings。
- **產出：** 符合 Spec 的產品與測試變更、逐步 Green commits，以及綁定目前 HEAD 的 `.ai-sdlc/local/<id>-<head>.json` 本機驗證結果。
- **完成：** `verify` 成功記錄目前 commit，且重新執行 `inspect` 後下一個工作不再屬於本 Skill。
- **檔案寫入：** 只修改 Spec 範圍內的產品、測試與必要專案設定，並建立本機 Green commits；不得修改已凍結 Spec、確認或模式。
- **外部操作：** 不 Push、不建立或更新 PR、不 Merge、不修改遠端設定。

## 做法

1. 確認 lock-pinned `.agents/skills/tdd/SKILL.md` 已依 `BOOTSTRAP.md` 安裝；缺少時先完成安裝 checkpoint，不得用自創 TDD 規則代替。再執行 `node .ai-sdlc-framework/bin/ai-sdlc.mjs inspect`，核對 work、Spec freeze、目前 HEAD、working tree 與 `nextAction`；不要依靠對話記憶判斷進度。
2. 一次選擇一個最小但可驗收的 vertical slice，使用 `$tdd` 完成 Red → Green；不要讓 `$tdd` 接管 commit、Review 或交付。
3. 先實際確認測試因預期行為尚未存在而 Red，再寫最小實作使其 Green。不要批量先寫全部測試，也不要以環境錯誤或零測試冒充 Red。
4. 只有 public interface、module 或 test seam 形狀確實未定時才參考 `$codebase-design`。若合理實作必須改變 Spec，停止實作並交回 `$define-requirement`，不要暗改需求。
5. 每個小階段執行受影響的 checks，通過後才建立本機 Green commit。修正 finding 前先確認它仍適用目前 HEAD。
6. 完成後使用 `verify` 執行專案完整驗證。任何新 commit 都使舊 verification、Review 與 delivery 證據失效。
7. 再執行 `inspect`；若仍要求實作、修正或驗證，依最新證據繼續處理。
