---
name: setup-project
description: "設定或接手使用 AI-SDLC 的程式專案。當 inspect 指出專案尚未初始化、開發與驗證命令不完整，或既有設定需要補齊時使用；不要用於一般功能需求。"
---

# Setup Project

## 邊界

- **何時使用：** 只在 `inspect.nextAction` 指向專案設定時使用。
- **需要：** Repository 現況、既有規則與修改、本機可用工具，以及預計如何交付。
- **產出：** 可重現的專案設定、實際可執行的完整驗證命令，或清楚的阻塞原因。
- **完成：** 重新執行 `inspect`，以它回傳的下一個工作判定；不要自行標記完成。
- **檔案寫入：** 只修改設定專案與驗證基線所需的檔案及 `.ai-sdlc/` 專案資料；不要建立產品功能。
- **外部操作：** 不 Push、不建立 PR、不 Merge、不修改遠端設定。安裝系統工具、修改系統設定或使用新憑證前先取得授權。

## 做法

1. 執行 `node .ai-sdlc-framework/bin/ai-sdlc.mjs check-install`，再執行 `inspect`；只處理它回傳的 next action。
2. 先讀取 repository 指令、build 設定、依賴、CI、remote、分支與 working tree，保留既有技術棧及使用者修改。
3. 判斷是新專案或接手既有專案。只有產品形態、長期技術棧、公開介面或交付方式需要人決定時，才使用 `$grilling` 訪談。
4. 只有 interface、module 或 test seam 確實有重要取捨時，才參考 `$codebase-design`；不要把它變成固定步驟。
5. 依 `contracts/toolchain.schema.json` 以 `{ "schemaVersion": 1, "checks": [...] }` 建立 argv-array 檢查清單，使用 `setup` 建立 Framework 管理資料，並補齊 repository-native 的 format、lint/static analysis、build、test、coverage 與其他適用命令。
6. 實際執行完整驗證。沒有測試、缺少工具或未執行命令時如實回報，不要當成通過。
7. 再執行 `inspect`；若仍回傳設定工作，依證據繼續修正或回報阻塞。
