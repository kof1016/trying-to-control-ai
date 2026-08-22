---
name: write-spec
description: "把新需求、需求變更或尚未釐清的驗收與邊界整理成可實作、可驗收的正式 Spec。當產品行為需要定義、既有 Spec 需要調整，或實作發現需求本身必須改變時使用；不要用於純工具鏈初始化或低階程式設計。"
---

# Write Spec

## Outcome

在 `specs/<short-kebab-name>.md` 產生一份足以開始實作、又不把 AI 偏好的實作方式升格成需求的正式 Spec。

## Uses

- `grilling`：讀取 `.agents/skills/grilling/SKILL.md`，使用其 design tree、frontier、前置條件與問題排序方法釐清真正需要決定的事項。`grilling` 不負責撰寫正式 Spec。

## Mode Handling

遵循 root `AGENTS.md` 定義的目前模式與提醒模板，不在此 Skill 複製模式模板。

- `supervised`：實際使用 `$grilling`，依上游流程逐輪詢問完整 frontier 並等待回答，直到共同理解與重要產品決策得到確認。
- `delegated`：不要啟動互動式 `$grilling`；讀取並在此 Skill 內套用其決策方法，在已授權範圍自行採用合理或推薦答案，只有超出授權邊界才詢問。
- `autonomous`：不要啟動互動式 `$grilling`；讀取並在此 Skill 內套用其決策方法，自行採用合理或推薦答案並記錄假設。只有 root `AGENTS.md` 定義的硬阻塞才能停止。

模式只改變決策者與等待點，不改變 Spec 的品質要求。

## Workflow

1. 讀取原始需求、root 與相關目錄的 `AGENTS.md`、相鄰程式、測試、文件及既有 Spec。
2. 自行查明可從 Repository、工具或公開資料取得的事實，不把事實查核問題丟給使用者。
3. 建立需求決策樹，先處理已具備前置條件的問題；不要讓尚未確定的下游選項污染目前決策。
4. 區分產品需求、既有系統限制、合理假設與可替換的實作決策。
5. 使用 `assets/spec-template.md` 建立或更新 `specs/<short-kebab-name>.md`。
6. 讓 Spec 清楚涵蓋適用的目標、可觀察行為、驗收條件、錯誤與邊界、非目標、必要技術限制，以及會影響實作或驗收的假設與決策。
7. 替換或刪除所有 placeholder；不適用的章節直接刪除，不填入無意義文字。
8. 在 `supervised` 模式呈現結果並取得必要確認；在 `delegated` 或 `autonomous` 模式於授權範圍內繼續後續流程。

## Specification Rules

- 把原始需求與必要背景放在同一份 Spec，不另建 `request.md`。
- 驗收條件描述外部可觀察結果，不預先切 function、class、interface、adapter 或資料夾。
- 只有使用者明確指定或既有 Repository 確實要求的技術條件，才能成為必要技術限制。
- Node.js、CLI、狀態保存、Manifest、Hash、Evidence、Adapter 或特定抽象若不是需求本身，不得寫成驗收條件。
- Spec 可以很短；資訊足夠比章節數量重要。
- 需求變更時直接更新相關 Spec，不建立 Freeze、Migration、Work ID 或流程狀態。

## Boundaries

- 不修改產品碼或測試。
- 不替實作者決定不影響產品行為的低階設計細節。
- 不建立流程狀態、確認檔、Hash、Evidence 或其他旁路紀錄。
