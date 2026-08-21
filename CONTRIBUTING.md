# 開發與基線驗證

本專案使用 Java 25、Spring Boot 4.1.1 與 Maven Wrapper。IDE 可提供操作入口，但 Maven Wrapper 命令是本機與 CI 共用的驗證來源。

## 必要環境

- JDK 25。
- `JAVA_HOME` 指向 JDK 25，且 `java` 可由命令列執行。
- 不需另外安裝 Maven；Repository 內的 Wrapper 會下載鎖定的 Maven 3.9.16。

目前已驗證的本機 JDK 位於：

```text
C:\Users\kof10\.jdks\temurin-25.0.4
```

PowerShell 工作階段若尚未設定 Java，可先執行：

```powershell
$env:JAVA_HOME = 'C:\Users\kof10\.jdks\temurin-25.0.4'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
```

## 常用命令

套用程式碼與文件格式：

```powershell
.\mvnw.cmd spotless:apply
```

執行格式、靜態編譯檢查、測試、Build 與 Coverage：

```powershell
.\mvnw.cmd verify
```

只執行測試：

```powershell
.\mvnw.cmd test
```

啟動應用程式：

```powershell
.\mvnw.cmd spring-boot:run
```

Coverage 報告產生於 `target/site/jacoco/index.html`。

## 基線範圍

初始專案只包含 Spring Boot 啟動類別及 context-load smoke test，尚未包含產品功能或產品 Unit Test。任何新需求都必須先依 `.ai-sdlc/WORKFLOW.md` 選擇模式、確認 Spec，再用 TDD 實作。

## GitHub CI

Pull Request 與 `main` 更新時，`.github/workflows/ci.yml` 會在乾淨的 Ubuntu／Temurin 25 環境執行 Maven Wrapper `verify`。本機應先通過相同命令，再 Push 到 GitHub。
