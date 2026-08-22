# 開發與驗證

本 Repository 同時包含 AI-SDLC Framework 與 Spring Boot Demo。Framework 使用 Node.js 20 以上且沒有 npm runtime dependency；Demo 使用 Java 25、Spring Boot 4.1.1 與 Maven Wrapper 3.9.16。

## 必要環境

- Git。
- Node.js 20 以上。
- JDK 25，`JAVA_HOME` 指向該 JDK。
- 可執行 Repository 內的 Maven Wrapper；不需另裝 Maven。

## Framework

產生 allowlisted 發行包與 manifest：

```bash
node scripts/build-framework-package.mjs
```

執行 contract／workflow tests：

```bash
node --test test/framework/*.test.mjs
```

執行完整 Clean-room drills：

```bash
node scripts/clean-room.mjs
```

驗證目前安裝副本：

```bash
node .ai-sdlc-framework/bin/ai-sdlc.mjs check-install
```

## Demo

套用 Java 與文件格式：

```bash
bash ./mvnw spotless:apply
```

執行格式、編譯警告、測試、Build 與 Coverage gate：

```bash
bash ./mvnw --batch-mode --no-transfer-progress verify
```

只執行測試：

```bash
bash ./mvnw test
```

Coverage 報告在 `target/site/jacoco/index.html`。

## 需求流程

1. 從最新 `main` 建立或由 CLI 建立 feature branch。
2. 整理 Spec，由人確認目前內容，再建立 Spec-only Freeze commit。
3. Freeze 後選擇模式；可以 Push branch 作備份，但此時不開 PR，也不要求 CI。
4. 依 Frozen Spec 進行 TDD、完整本機驗證、Implementation Review 與 Test Review。
5. `preflight` 通過後 Push 並建立一個 PR；任何新 commit 都要重跑驗證與兩份 Review。
6. 受信任的 GitHub Adapter 即時查詢目標 branch、Required Checks、review decision／threads、conflicts 與 mergeability，將 Draft 轉 Ready 後在 Merge 入口立即重查；非 Required CI 不作額外 gate。

`AGENTS.md` 是 Router；不得重新引入 `.ai-sdlc/WORKFLOW.md` 或另一份平行流程規則。

## CI

`.github/workflows/ci.yml` 只在 Pull Request 與 `main` 更新時執行，不因單純 Push feature branch 而啟動。CI 會在乾淨環境重跑 Framework tests、Clean-room 與 Maven `verify`。

Repository 目前是否有 Branch Protection／Required Checks，必須以 GitHub 即時查詢結果為準；configured check 成功不等於它被設定為 Required。
