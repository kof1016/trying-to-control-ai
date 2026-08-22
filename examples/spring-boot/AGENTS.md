# Spring Boot Example 規則

本檔只補充 `examples/spring-boot/` 的技術棧規則；root `AGENTS.md` 的模式、Skill 路由、Review 與交付規則仍然適用。

## 建置與驗證

從 Repository root 執行：

```bash
mvn --file examples/spring-boot/pom.xml --batch-mode --no-transfer-progress verify
```

從本目錄執行：

```bash
mvn --batch-mode --no-transfer-progress verify
```

使用 `pom.xml` 宣告的 Java、Spring Boot、測試與品質設定。不要生成或提交 Maven Wrapper；不要讓此 POM 格式化或依賴 Repository root 的 Framework 文件。

## Production code

- 沿用 `com.github.kof1016.aiworkflowdemo` package 與 Spring Boot 慣例。
- HTTP Controller 只負責 transport boundary：routing、request／response、serialization、HTTP validation 與 status mapping。
- 應用／核心行為放在可直接測試的 concrete Service；即使行為簡單，也不要把 transport 與核心責任混在 Controller。
- Error mapping 與核心錯誤保持責任分離，但只在新 Spec 確實需要時建立對應類別。
- 不新增沒有真實替代實作的 Java `interface` + `ServiceImpl`、Adapter、Strategy、Factory 或多層轉發。
- 新 dependency 必須服務目前 Spec 或既有 build/test 基線；不預裝想像中的功能。

## Tests

- Service Unit Test 直接驗證核心／應用行為與重要邊界。
- HTTP behavior/integration test 經過 Spring MVC、request parsing、validation／error mapping 與 serialization，驗證公開 HTTP 契約。
- 測試經 public seam 觀察行為，不耦合 private implementation。
- 每個 Red 都必須實際執行，確認是預期行為缺失，而不是環境錯誤、非預期編譯錯誤或零測試。
- 完成後執行完整 `verify`；coverage 數字不能取代測試品質 Review。

