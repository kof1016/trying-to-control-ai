---
name: write-spec
description: "把新需求、變更或 Spec finding 整理成可實作、可驗收的產品 Spec。產品行為、驗收條件或重要邊界未定時使用；純 setup，以及不影響外部行為、驗收條件或重要邊界的實作選擇不適用。"
---

# Write Spec

## Uses

讀取 `.agents/skills/grilling/SKILL.md`，使用其決策樹與 frontier 方法釐清真正需要決定的事項。

## Modes

模式規則優先於 `grilling` 的互動要求：

1. 逐步確認（`supervised`）：執行互動式 `$grilling`，逐輪等待使用者決定；design tree 只包含影響產品契約的決策，不追問低階實作選擇。
2. 全自動（`autonomous`）：只把 design tree／frontier 當成內部推理方法，不套用 `grilling` 的詢問、等待或使用者確認要求；Agent 依證據決定並記錄已採用且影響契約的假設，只有 root 硬阻塞才能停止。

## Workflow

1. 讀取需求、適用的 `AGENTS.md`、現有產品碼、測試與 Spec。
2. 自行查明可從 Repository、工具或可信來源取得的事實。
3. 依決策前置關係處理未決事項，區分產品需求、既有限制與實作選擇。
4. 使用 `assets/spec-template.md` 在 `specs/<slug>.md` 建立或更新 Spec，移除不適用章節與所有 placeholder。
5. 驗收條件只描述外部可觀察結果；技術限制只保留使用者指定或 Repository 確實要求的內容。
6. 確認驗收條件可觀察、可驗證，契約決策已由使用者確認或明示為 autonomous 採用的假設，且沒有不必要的實作選擇。
7. 完成時回報 Spec path、成立方式（使用者確認／Agent 定稿）、關鍵假設與仍未解 blocker，再交回 root Router。

## Exit conditions

- Spec 沒有 placeholder。
- 驗收條件可觀察、可驗證。
- 契約決策已確認，或已明示為 autonomous 採用的假設。
- 沒有不必要的實作選擇。

## Boundaries

- 不修改產品碼或測試，也不替實作者決定不影響契約的細節。
- 不選擇或啟動下一個 Stage Skill。
