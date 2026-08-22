---
name: write-spec
description: "把新需求或變更整理成可實作、可驗收的產品 Spec。產品行為、驗收條件或重要邊界未定時使用；純 setup 與低階實作問題不適用。"
---

# Write Spec

## Uses

讀取 `.agents/skills/grilling/SKILL.md`，使用其決策樹與 frontier 方法釐清真正需要決定的事項。

## Modes

1. 逐步確認（`supervised`）：實際使用 `$grilling`，逐輪等待使用者決定。
2. 全自動（`autonomous`）：不啟動互動式 grilling；自行採用合理答案並記錄仍影響契約的假設，只有 root 硬阻塞才能停止。

## Workflow

1. 讀取需求、適用的 `AGENTS.md`、現有產品碼、測試與 Spec。
2. 自行查明可從 Repository、工具或可信來源取得的事實。
3. 依決策前置關係處理未決事項，區分產品需求、既有限制與實作選擇。
4. 使用 `assets/spec-template.md` 建立或更新 Spec，移除不適用章節與所有 placeholder。
5. 驗收條件只描述外部可觀察結果；技術限制只保留使用者指定或 Repository 確實要求的內容。
6. 逐步確認模式取得確認後交付；全自動模式在授權範圍內繼續。

## Boundaries

- 不修改產品碼或測試，也不替實作者決定不影響契約的細節。
