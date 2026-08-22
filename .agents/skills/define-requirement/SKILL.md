---
name: define-requirement
description: "把軟體需求整理成可確認、可測試並可本機凍結的正式 Spec。當 inspect 指出需要建立新工作、補完 Draft、取得確認、凍結 Spec，或重新開啟 Spec 時使用。"
---

# Define Requirement

## 邊界

- **何時使用：** 只在 `inspect.nextAction` 指向需求或 Spec 工作時使用。
- **需要：** 使用者原始需求、repository 證據，以及 `inspect` 回傳的 work id 與檔案路徑。
- **產出：** `.ai-sdlc/work/<id>/request.md`、`spec.md`、`work.json` 中可驗證的確認與 freeze 事實。
- **完成：** 重新執行 `inspect`，以它回傳的下一個工作判定；不要把口頭確認或聊天內容當成已凍結 Spec。
- **檔案寫入：** 只寫目前 work 目錄與 Spec-only 本機 commit；不要寫產品碼或測試。
- **外部操作：** 不 Push、不建立 PR、不執行遠端 CI、不 Merge。

## 做法

1. 執行 `node .ai-sdlc-framework/bin/ai-sdlc.mjs inspect`，只處理 `nextAction` 指定的工作。沒有 work 時，以簡短、可辨識的 work id 使用 `start` 保存原始需求；CLI 會建立並提交 Draft authority，路徑不手工編造。
2. 先讀相關程式、規則與相鄰功能。需求、範圍、驗收、重要錯誤、風險或 test seam 尚未確定時，使用 `$grilling` 訪談；可自行查證的事實不要反問使用者。
3. 把訪談結果整理進正式 `spec.md`。`$grilling` 只負責訪談，不負責寫 Spec、確認或 freeze。
4. 讓 Spec 清楚說明目標、可驗收行為、重要邊界與錯誤、非目標及驗證方式；只在 interface/module/seam 真有取捨時參考 `$codebase-design`。
5. 向人類呈現目前 Spec 並取得明確確認。即使使用全自動模式，也不得代替人決定產品行為；只在 `inspect.nextAction` 要求時使用 `freeze --confirmation-source <source>` 保存確認來源並建立 freeze。
6. `inspect.nextAction` 為 `spec-change-needed` 時，使用 `reopen` 保存理由，再重新整理、確認及 freeze；不要手工改寫 `work.json` 的受管事實。
7. 每個動作後重新執行 `inspect`，直到下一個工作不再屬於本 Skill，或出現需要人類決定的問題。
