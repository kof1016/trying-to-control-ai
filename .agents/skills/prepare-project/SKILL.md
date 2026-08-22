---
name: prepare-project
description: "為目前交付建立最小、可重現的建置與測試基線。當空白專案需要初始化、實作既有 Spec 前缺少必要工具鏈、任務本身要求整理專案設定，或純 setup Review finding 需要修正時使用；不要只因 Repository 陌生，或因產品實作中的一般編譯與測試失敗而使用。"
---

# Prepare Project

## Outcome

建立目前任務真正需要的最小專案骨架與 Repository-native build/test 基線，並實際證明相關命令可執行。

## Uses

沒有固定第三方 Skill。先沿用 Repository 既有工具與慣例，不為 Setup 預設設計方法或產品技術棧。

## Workflow

1. 讀取 root `AGENTS.md`、目標專案的局部 `AGENTS.md`、既有 build 設定、CI、目錄結構與可用工具。
2. 判斷目前是否真的缺少完成任務所需的建置或測試基線。陌生但已能建置與測試的專案不需要重新 Setup。
3. 既有技術棧可用時直接沿用；空白產品專案只根據已完成且足以實作之 Spec 的交付形式與必要技術限制選擇最小工具鏈，setup-only 任務則以明確 task／handoff 為基準。
4. 建立或修正最少必要的專案檔案與設定，不預建未被目前需求使用的部署、套件、抽象或多語言骨架。
5. 執行實際的 build/test 命令。缺少工具、零測試或未執行的命令不得描述為通過。
6. 把穩定且可重現的操作命令寫入目標 example 的 `AGENTS.md`；只有人類確實需要的啟動方式才補充到 README。
7. 回報建立的基線、實際執行的命令、結果與仍存在的阻塞，交由 `review-implementation` 審查。

## Boundaries

- 不定義產品需求、不建立產品 Spec，也不實作產品行為。
- 產品行為、交付形式或必要技術限制尚未確定時，先交回 `write-spec`。
- 一般編譯錯誤、測試失敗或產品實作問題留在 `implement-spec` 修正，不把它們重新分類成 Setup。
- 不為 Framework 建立 Runtime、CLI、狀態檔、Manifest、Hash、Evidence、Installer 或自訂 Workflow Engine。
- 不加入只服務想像中未來需求的工具與設定。
