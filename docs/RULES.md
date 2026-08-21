# 權威規則

## 四個維度必須分開

| 維度 | 可選狀態 | 它只回答什麼 |
|---|---|---|
| 程式碼作者 | 人類／AI／共同完成 | 誰產生這段變更 |
| 自動化模式 | 監督／委派／全自動 | 哪些動作需要即時 Approval Gate |
| Git 狀態 | working tree／staged／local commit／pushed／merged | 變更目前在哪一層 |
| 驗證位置 | 本機相關檢查／本機 full verify／本機 Review／GitHub clean revalidation | 哪一組證據已成立 |

任何一軸都不能推論另一軸。人類寫的程式也要過相同驗證；AI 寫的程式不因此自動 push；全自動模式不代表略過 Review；本機 commit 不代表已發布。

## 工作區與真實來源

- 本機 repository 是人類與 Codex 共用的工作區。既有修改先視為使用者工作，判明來源前不得覆蓋或清除。
- Normal point 的 Frozen Spec 識別是 `spec path @ freeze commit SHA`；branch 以唯一 committed point manifest 攜帶它，受保護且不可移動的 trusted freeze tag 作人類確認 attestation。實作、測試與 Review 必須引用同一組識別，PR body 不是權威來源。唯一例外是遠端建立前匯入本交接包的 `bootstrap-local` profile：它以已接受交接包的 baseline commit 為 authority，不假造 product Spec／manifest／tag，且第一次 Push 後立即退役。
- 實際程式碼、測試、toolchain 設定及 package scripts 是可執行事實。文件不重抄一份容易過時的命令；只定義命令必須提供的契約。
- Review 的範圍是已完成的 committed range；Push 前 working tree 必須乾淨，避免漏看未提交內容。
- 驗證結果只能報告實際執行的命令、版本、範圍與 exit status。沒有執行就標示 `NOT RUN`，不能推定為通過。

## 不可略過的品質規則

- 一次只做一個 vertical slice；正常實作使用 Red → Green。
- 每個邏輯小階段在相關 Format、Lint、Build、Test 通過後才可建立本機 Green commit。
- 完整 point 在 Push 前必須通過 full local verify、Implementation Review 與 Test Review。
- Review 修正也是新變更：要重跑受影響檢查、建立 Green commit；只要 `HEAD` 改變，就重跑 full verify 與兩份 Review，並把 verdict 綁到相同的最終 `HEAD`。
- GitHub 是獨立重驗與不可繞過的 Merge Gate，不是正常流程的第一個 debugger。
- 不以刪除、跳過或弱化測試來讓 gate 變綠。Lint、coverage、安全或其他品質門檻的變更必須走獨立、明確授權的 policy change；Spec 變更本身不能授權降低品質門檻。
- 不靜默擴充 scope，也不在實作中偷改 frozen Spec。

## Codex 的決策邊界

Codex負責判斷並執行下一個可逆、已授權、規則明確的步驟，不把一般操作轉嫁給使用者。只有下列情況停下：

1. 需求、scope、驗收條件、test seam 或風險取捨需要人類決策。
2. 當前模式要求的 Approval Gate 尚未取得；其中外部寫入、push、PR、merge、憑證或費用必須落在明確授權範圍。
3. 刪除、覆寫歷史、公開資料或其他不可逆／難回復操作。
4. 被採用的 Skill 明定必須由使用者啟動；本版選用的三個 Skill 均允許 Codex 依情境啟動。
5. 權限、受保護流程或環境限制明確阻擋。

「監督／委派／全自動」只改變第 2 項涵蓋哪些本機或外部動作、授權何時取得，不改變需求由人類裁決，也不改變品質規則。

所有品質 gate 統一用 `PASS`、`FAIL`、`N/A（附適用性理由）`、`NOT RUN` 記錄。`N/A` 只能來自已知技術棧或 repository policy 的不適用判斷；未設定、忘記執行或沒有證據都不是 `N/A`。

## 第一階段禁區

在 A+B Spec 尚未凍結前，不建立 A+B 程式碼、測試、假資料或技術棧；在 CI 實作階段尚未授權前，不建立 Actions、ruleset 或 secrets。這是交付邊界，不是未完成工作可由代理自行補齊的提示。
