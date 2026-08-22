# AI-SDLC Demo

這個 Repository 展示一套由 `AGENTS.md`、Repository-scoped Skills、Specs 與 GitHub Flow 組成的輕量 AI-SDLC。流程規則維持為文字與 Skill，不需要額外 Runtime、CLI、狀態機或 Evidence 系統。

## 執行模式

- `supervised`：重要決策與未授權的外部操作會等待確認。
- `delegated`：在已授權範圍內自動執行，超出邊界才詢問。
- `autonomous`：自行採取合理方案，只有 Repository 定義的硬阻塞才停止。

模式不會跳過 Spec、適用的 TDD、完整驗證或 Review。每個任務的模式與切換規則以根目錄 [`AGENTS.md`](AGENTS.md) 為準。

## 流程與 Skills

一般產品流程為：

```text
write-spec →（必要時 prepare-project）→ implement-spec → validation → review-implementation
```

四個第一方 Skills 各自負責：

- `write-spec`：把需求整理成可實作、可驗收的 Spec。
- `prepare-project`：只在缺少 build/test 基線時建立最小工具鏈。
- `implement-spec`：依 Spec、設計準則與 TDD 完成產品與測試。
- `review-implementation`：獨立執行 Implementation Review 與 Test Review。

三個第三方 Skills 提供局部方法：

- `grilling`：釐清需求決策前沿。
- `tdd`：指導 Red → Green 的測試驅動流程。
- `codebase-design`：提供責任、interface 與 test seam 的設計準則。

第三方來源與授權見 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

## Repository 結構

```text
.agents/skills/           Repository-scoped Skills
.github/                  Pull Request template 與 GitHub Actions
examples/spring-boot/     可獨立建置與測試的 Spring Boot example
specs/                    已確認或流程產生的產品與重構 Specs
AGENTS.md                 模式、路由、Review 與交付規則
```

## Spring Boot example

需要 POM 宣告版本相容的 JDK 25 與系統 Maven。從 Repository root 執行完整驗證：

```bash
mvn --file examples/spring-boot/pom.xml --batch-mode --no-transfer-progress verify
```

若要啟動 example：

```bash
mvn --file examples/spring-boot/pom.xml spring-boot:run
```

更具體的技術規則見 [`examples/spring-boot/AGENTS.md`](examples/spring-boot/AGENTS.md)。

## Git、Pull Request 與授權

每項變更使用 feature branch 與一個 Pull Request；Commit 採輕量 Conventional Commit。最終驗證、Implementation Review、Test Review 與 PR 必須對應同一個已提交 Head，新 Commit 後全部重跑。Push、建立或更新 PR、CI 與 Merge 只在目前任務的授權範圍內執行，並遵守 GitHub Branch Protection 與真人 approval 要求。
