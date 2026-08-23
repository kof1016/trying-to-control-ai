---
name: prepare-project
description: "建立目前交付所需的最小、可重現 build/test 基線。空白專案、缺少必要工具鏈或 setup finding 時使用；專案陌生與一般產品錯誤不適用。"
---

# Prepare Project

## Workflow

1. 讀取適用的 `AGENTS.md`、build 設定、CI、目錄結構與可用工具。
2. 確認目前交付缺少基線或存在 setup finding；兩者皆無則記錄目前不需要 setup 變更。
3. 沿用既有技術棧；空白產品專案依已成立且可實作的 Spec 選擇工具，純 setup 則依明確 task。
4. 建立最少必要的檔案、dependency 與設定。
5. 執行實際 build/test；缺少工具、零測試或未執行的命令不能算通過。
6. 確保可重現命令已記錄於目標 project 的 `AGENTS.md`。
7. 完成時回報 changed files、可重現命令、實際 build/test 結果、是否確實執行到測試，以及仍未解 blocker，再交回 root Router。

## Boundaries

- 不定義或實作產品行為。
- 產品契約仍未成立、發現不屬於 setup 的產品碼／測試問題、基線已可重現或目前不需要 setup 變更時，只回報 finding 類型與證據，再交回 root Router。
- 不選擇或啟動下一個 Stage Skill，也不新增 setup manifest。
