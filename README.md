# Trying to Control AI

> 我試著控制 AI——不是限制它思考，而是讓它先跟你一起理清規格與功能邊界，再開始寫程式。

AI 寫得很快；真正讓人崩潰的，往往不是它完全做錯，而是它做得比你要求更多：

- 自行補上沒有說出口的假設。
- 順手增加功能，或為想像中的擴充性多做幾層架構。
- 程式能跑、測試也通過，人卻還是不確定這是不是自己真正要的。

這個 Demo 把 AI 的推理能力放在更前面：先一起把需求、功能邊界與驗收方式說清楚，再讓同一份 Spec 帶著後續工作往下走。

**整套工作流沒有另外用腳本控制流程。**

我用單一職責切分能力與階段，再由 AI 根據目前結果判斷下一步。

信任不是要 AI 保證不犯錯，而是讓影響產品的決定與最後如何驗收，都能被看見。

## 從一句「做一個 A＋B API」開始

定出規格並不簡單。即使只是 A＋B，真正問下去，才會發現需求和想像往往有落差。

![AI 釐清 A＋B API 需求的對話：先確認技術棧與資料型別，再追問呼叫方式、回傳格式與功能邊界](./docs/assets/readme/spec-clarification.gif)

*這段對話只示範需求如何被問清楚；畫面中的選擇不代表目前專案功能或契約。*

目前三個可執行範例共同遵循的契約，見[整數加法 API Spec 的驗收條件](specs/addition-api.md#驗收條件)。

<details>
<summary>停下來看兩輪追問</summary>

**第一輪：從技術棧與資料型別，問到呼叫方式、回傳格式與整數範圍。**

[![第一輪需求追問：AI 提出呼叫方式、回傳格式與整數範圍的問題和建議](./docs/assets/readme/spec-clarification-step-1.png)](./docs/assets/readme/spec-clarification-step-1.png)

**第二輪：根據前一輪的選擇，繼續確認請求格式與存取控制。**

[![第二輪需求追問：AI 根據使用者的選擇，繼續確認 POST 請求格式與存取控制](./docs/assets/readme/spec-clarification-step-2.png)](./docs/assets/readme/spec-clarification-step-2.png)

</details>

## 這套流程怎麼運作

前面的追問會收斂成 Spec，成為後續實作、測試與 Review 的共同依據。

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "fontFamily": "Microsoft JhengHei, Noto Sans TC, Arial, sans-serif",
    "lineColor": "#2563EB",
    "textColor": "#0F172A",
    "edgeLabelBackground": "#F8FAFC"
  },
  "flowchart": {
    "curve": "stepAfter",
    "nodeSpacing": 42,
    "rankSpacing": 48
  }
}}%%
flowchart TB
    S([需求釐清與 Spec 確認]):::start --> I["以 TDD 實作<br/>失敗測試 → 最小實作 → 重複"]:::step
    E["需要時：準備開發與測試工具"]:::optional -.-> I

    I --> IR{"Implementation Review<br/>實作符合 Spec？"}:::review
    I --> TR{"Test Review<br/>測試足以驗收 Spec？"}:::review

    IR -->|是| OK["兩種 Review 均通過"]:::passed
    TR -->|是| OK
    IR -->|否：修正| I
    TR -->|否：修正| I

    OK --> D([交付]):::delivery

    classDef start fill:#F8FAFC,stroke:#475569,color:#0F172A,stroke-width:2px;
    classDef optional fill:#F1F5F9,stroke:#94A3B8,color:#334155,stroke-width:1.5px,stroke-dasharray:5 4;
    classDef step fill:#EFF6FF,stroke:#2563EB,color:#172554,stroke-width:2px;
    classDef review fill:#FFFBEB,stroke:#D97706,color:#78350F,stroke-width:2px;
    classDef passed fill:#ECFDF5,stroke:#059669,color:#064E3B,stroke-width:2px;
    classDef delivery fill:#ECFDF5,stroke:#059669,color:#064E3B,stroke-width:2px;

    linkStyle default stroke:#2563EB,stroke-width:2px;
    linkStyle 1 stroke:#94A3B8,stroke-width:1.5px;
    linkStyle 6,7 stroke:#DC2626,stroke-width:2.5px;
```

可測的產品行為會在實作階段以 TDD 的小循環逐步完成。兩種 Review 都通過才進入交付；紅色實線代表實際的修正路徑。修正後會重新執行適用檢查，並重做兩種 Review。

### 對應的 Skill

| 工作 | Skill |
| --- | --- |
| 釐清需求並確認 Spec | `write-spec` |
| 按需準備開發與測試工具 | `prepare-project` |
| 依 Spec 以 TDD 實作 | `implement-spec` |
| Implementation／Test Review | `review-implementation` |

## 每一步都能被檢查

| 階段 | 留下的內容 | 它回答的問題 |
| --- | --- | --- |
| Spec | 產品行為、輸入邊界與驗收條件 | AI 理解的是不是使用者要的？ |
| 實作與測試 | 產品程式碼與可執行的驗收測試 | 實際做了什麼，又如何證明？ |
| 兩種 Review | 實作與測試各自的審查結果 | 有沒有越界？測試真的驗得到嗎？ |
| 交付 | 明確版本與完整檢查結果 | 最後交付的是哪個版本？ |

## 如何使用

把自然語言需求交給支援 Repository 規則與 Skills 的 coding Agent：

```text
請依 Repository 規則完成以下需求：

<用自然語言描述需求>
```

預設採逐步確認：AI 提出問題與建議，重要決策由使用者確認後再繼續。

## Repository 結構

工作流不綁定技術棧；同一份 A＋B Spec 目前由 Spring Boot、Go Gin 與 NestJS 三個可獨立執行的範例實作，用來確認契約與驗收方式可以跨技術棧保持一致。

```text
.
├── .agents/
│   └── skills/
│       ├── write-spec/             釐清並產生可驗收的 Spec
│       ├── prepare-project/        按需準備開發與測試工具
│       ├── implement-spec/         依 Spec 實作產品與測試
│       ├── review-implementation/  Implementation／Test Review
│       ├── grilling/               需求追問方法
│       ├── tdd/                    TDD 方法
│       └── codebase-design/        Codebase 設計方法
├── .github/
│   ├── pull_request_template.md    交付與 Review 紀錄格式
│   └── workflows/
│       ├── spring-boot.yml         Spring Boot CI
│       ├── go-gin.yml              Go Gin CI
│       └── nestjs.yml              NestJS CI
├── docs/
│   └── assets/readme/              README 示範圖
├── examples/
│   ├── spring-boot/                Java 25／Spring Boot 範例
│   ├── go-gin/                     Go 1.27.0／Gin 1.12.0 範例
│   └── nestjs/                     Node.js 26.7.0／TypeScript 7.0.2／NestJS 11.2.1 範例
├── specs/
│   └── addition-api.md             三個範例共用的 A＋B 產品契約
├── AGENTS.md                       工作流與交付規則
├── CONVERSATION_RULES.md           對話與回覆規則
└── THIRD_PARTY_NOTICES.md          第三方來源與授權
```

<details>
<summary>執行 A＋B 範例</summary>

三個範例都提供 `GET /add?a=1&b=2`，成功時回傳：

```json
{"result":"3"}
```

完整輸入格式、任意大小整數與錯誤行為由上述 Spec 定義。各範例的完整驗證命令如下。

Spring Boot（Java 25）：

```bash
cd examples/spring-boot
./mvnw --batch-mode --no-transfer-progress verify
```

Windows 使用 `mvnw.cmd`。

Go Gin（Go 1.27.0、Gin 1.12.0）：

```bash
cd examples/go-gin
go test ./...
go build ./...
```

NestJS（Node.js 26.7.0、TypeScript 7.0.2、NestJS 11.2.1、Jest 30.4.2）：

```bash
cd examples/nestjs
npm ci
npm run verify
```

Jest 透過 SWC 直接執行 TypeScript 測試；`tsc --noEmit` 另行負責型別檢查，不會產生測試用 JavaScript 檔。

</details>

## 需要時，AI 也會準備開發與測試工具

若目標專案還不能穩定建置或測試，AI 會沿用既有技術棧，依目前需求補齊最少必要的設定、依賴與命令，讓格式、lint／靜態分析、型別／編譯、單元／整合測試與建置可以重複執行。實際項目由專案需求決定；已有適用工具時不會另建一套。

## GitHub CI

Pull Request 與 `main` 更新時，[GitHub Actions](.github/workflows/) 會分別以 Java 25、Go 1.27.0 與 Node.js 26.7.0 重跑三個範例定義的完整檢查，其中包含測試。CI 是對同一套本機檢查的重驗證，不是另一套測試流程。

## 第三方來源

`grilling`、`tdd` 與 `codebase-design` 來自 [mattpocock/skills](https://github.com/mattpocock/skills) `v1.2.3`。保留內容、本地調整範圍與 MIT License 見 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。
