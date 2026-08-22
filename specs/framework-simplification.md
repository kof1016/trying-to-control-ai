# 精簡 AI-SDLC Framework Demo

## 背景

目前 Repository 把跨語言 AI 流程、Framework 專屬 Runtime／狀態機制與 Spring Boot Demo 混在同一層，增加理解與展示成本。這次重構要回到以 `AGENTS.md`、Repository-scoped Skills 與少量文字模板驅動的輕量 Demo。

## 目標

- 人類能從根目錄快速分辨 Framework、Specs、Examples 與 GitHub automation。
- AI 能以四個責任明確的第一方 Skills 完成需求規格、條件式專案準備、實作與兩視角 Review。
- Spring Boot example 先成為無產品功能、但能完整 build/test 的乾淨 baseline，供後續新需求重跑。

## 可觀察行為與驗收條件

- [ ] 舊四個第一方 Skills 已完整刪除，四個新 Skills 已由最終逐字來源乾淨建立。
- [ ] `grilling`、`tdd`、`codebase-design` 與重構 base 的 `origin/main` 原文相同。
- [ ] root `AGENTS.md` 定義三種模式、非阻塞 autonomous 適配、Skill 路由、finding 分流與交付規則。
- [ ] Spec template 只存在 `write-spec/assets/`，模式提醒只存在 root `AGENTS.md`，PR template 只存在 GitHub 原生位置。
- [ ] Spring Boot 專案位於 `examples/spring-boot/`，只含最小 skeleton，且系統 Maven 完整 `verify` 通過。
- [ ] baseline 不含 A+B Spec、production code 或 feature tests。
- [ ] GitHub Actions 只驗證 Spring Boot example，不安裝 Node 或封裝 Framework。
- [ ] README 能在幾分鐘內說明目的、模式、流程、Skills、結構、example 操作與 GitHub Flow。
- [ ] Implementation Review 與 Test Review 對 PR Head 都是 PASS。

## 非目標

- 不保留或重建 Framework Runtime、CLI、安裝器、狀態、Freeze、Hash、Manifest、Lock、Migration 或 Evidence 系統。
- 不用 Python、Go、Bash 或其他語言取代已移除的 Runtime。
- Baseline commit 不實作或保留 A+B 產品契約；同一分支後續才以新 Skills 重跑。
- 不建立獨立 Framework Repository、Submodule、Library package、Plugin 或尚未使用的其他語言 example。

## 必要技術限制

- 既有 Repository 與最新 `origin/main` 是程式事實基準。
- 三個第三方 Skills 保留上游內容與授權。
- Spring Boot example 使用其 POM 宣告的 Java／Maven 工具鏈；POM 不屬於跨語言 Framework。

## 假設與決策

- 同一分支先建立並驗證沒有 A+B 的 baseline commit；後續 commits 才由新 Skills 重新生成 A+B，最終一起交付一道 PR。
- `prepare-project` 是條件式能力；baseline 已可建置與測試時，A+B replay 必須跳過它。
