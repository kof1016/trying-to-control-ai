# AI-SDLC Demo

這個 Repository 以 `AGENTS.md`、Repository-scoped Skills 與 GitHub Flow 展示輕量 AI-SDLC。模式、Skill 路由與交付規則以 [`AGENTS.md`](AGENTS.md) 為準；各 Skill 的觸發條件與做法由其 `SKILL.md` 定義。

第三方 Skills `grilling`、`tdd`、`codebase-design` 保留上游原文；來源與授權見 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

## 結構

```text
.agents/skills/           Repository-scoped Skills
.github/                  PR template 與 CI
examples/spring-boot/     Minimal Spring Boot shell
AGENTS.md                 AI 執行與交付規則
CONVERSATION_RULES.md     對話與回覆原則
```

## Spring Boot shell

需要 JDK 25；Maven 由範例內的 Wrapper 提供。進入 `examples/spring-boot/` 後驗證：

```bash
./mvnw --batch-mode --no-transfer-progress verify
```

Windows 使用 `mvnw.cmd`。

啟動：

```bash
./mvnw spring-boot:run
```
