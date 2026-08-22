---
name: review-change
description: "對已提交且完整本機驗證過的軟體變更執行兩份獨立 Review：Implementation Review 與 Test Review。當 inspect 指出目前 commit 缺少有效 Review，或修正後需要重新審查時使用。"
---

# Review Change

## 邊界

- **何時使用：** 只在 `inspect.nextAction` 指向 Implementation Review 或 Test Review，且本機驗證仍綁定目前 HEAD 時使用。
- **需要：** `inspect` 指定的已凍結 `spec.md`、base-to-HEAD committed diff、測試與目前 HEAD 的 verification evidence。
- **產出：** 分開綁定目前 HEAD 的 Implementation 與 Test verdict；finding 必須包含位置、證據、影響與可驗證修正方向。
- **完成：** `review` 已保存 `inspect.nextAction` 要求的 verdict，且重新執行 `inspect` 後下一個工作不再屬於本 Skill。
- **檔案寫入：** 只透過 `review` 更新 `.ai-sdlc/local/<id>-<head>.json`；不得修改產品碼、測試或已凍結 Spec。
- **外部操作：** 不 Push、不發表遠端 Review、不建立 PR、不 Merge。

## 做法

1. 執行 `node .ai-sdlc-framework/bin/ai-sdlc.mjs inspect`，核對 Spec freeze、committed range、clean working tree、verification evidence、`nextAction` 與 `requiredReviews`；舊 HEAD 的證據不得沿用。
2. `requiredReviews` 包含 `implementation` 時，逐項對照 Spec 與 committed diff，檢查行為正確性、範圍、錯誤處理、安全、相容性、設計取捨與可維護性。
3. `requiredReviews` 包含 `test` 時，將驗收條件、風險與 public seams 對應到實際測試，檢查失敗敏感度、邊界與錯誤路徑、assertions、determinism、mock 邊界及 coverage 證據。
4. 需要時使用不同 subagents 提供獨立視角，但不要用固定 Agent 數量代替可查證的 Review 證據。
5. 使用 `review` 保存目前要求的單一 verdict。不要把命令 Green、coverage 百分比、另一份 Review 的結果或綜合摘要當成這份 verdict。
6. Review 有 blocking finding 時，不直接修改檔案；交回 `$implement-change` 修正。新 commit 必須重新驗證並重跑兩份 Review。
7. 再執行 `inspect`；若仍要求另一份或重新 Review，使用新的 `nextAction` 繼續。

## 邊界限制

- Review 只讀 committed range；不得把未提交修改納入 verdict 或漏在範圍之外。
- 不直接修正 finding，避免 Reviewer 同時改變自己正在判定的證據。
- Publish 與 recovery 由 CLI/Router 負責；不要在本 Skill 增加 Push、PR、CI 或 Merge 流程。
