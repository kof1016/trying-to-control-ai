---
name: prepare-project
description: "建立目前交付所需的最小、可重現 build/test 基線。空白專案、缺少必要工具鏈或 setup finding 時使用；專案陌生與一般產品錯誤不適用。"
---

# Prepare Project

## Workflow

1. 讀取適用的 `AGENTS.md`、build 設定、CI、目錄結構與可用工具。
2. 確認目前交付缺少基線或存在 setup finding；兩者皆無則交回 Router。
3. 沿用既有技術棧；空白產品專案依已確認 Spec 選擇工具，純 setup 則依明確 task。
4. 建立最少必要的檔案、dependency 與設定。
5. 執行實際 build/test；缺少工具、零測試或未執行的命令不能算通過。
6. 確保可重現命令已記錄於目標 project 的 `AGENTS.md`，再交由 `review-implementation`。

## Boundaries

- 不定義或實作產品行為；需求未定時交回 `write-spec`。
- 產品碼、測試與一般編譯問題交回 `implement-spec`。
