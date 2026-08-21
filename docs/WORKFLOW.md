# 本機優先工作流

## 名詞

| 名詞 | 定義 |
|---|---|
| Frozen Spec | 人類確認後，以專用 commit 凍結的需求文件；用 `path @ commit SHA` 唯一識別 |
| Point manifest | `.ai-sdlc/points/<point-id>.json`；branch 內唯一、machine-readable 的 Spec／base 指標，PR body 只顯示它 |
| Trusted freeze ref | `refs/tags/spec-freeze/<point-id>/<freeze-sha>`；由受保護 tag ruleset 限制建立與禁止移動，作為人類 freeze attestation |
| Vertical slice | 一個可由 public seam 觀察的最小完整行為，不是「先做所有 model、再做所有 UI」的水平分層 |
| 邏輯小階段 | 一組已達 Green、可獨立說明且值得回復的變更；預設等同一個 vertical slice |
| Green commit | 相關檢查通過、內容不含已知破壞的本機 commit；不等於已 full verify 或已 Push |
| Point | Frozen Spec 中一個完整、可驗收、可 Review 的交付點；可包含多個 slice |
| 相關檢查 | 對當前小階段受影響範圍執行的 Format、Lint、Build、Test 子集 |
| Full local verify | Repository 日後定義的單一權威入口，執行全部本機 deterministic checks 與 coverage policy |
| Point base | 開始該 point 前的固定 commit；Push 前 Review 比較它與 `HEAD` 的 committed range |

本文件的正常 point 契約從 pre-remote Bootstrap 完成後生效。初次匯入本交接包與安裝 repo Skills 不是 A+B 功能 point；它只能使用 [`REVIEWS.md`](REVIEWS.md) 明定的一次性 `bootstrap-local` profile，不建立假的產品 Spec、point manifest 或尚不存在的 protected tag。該例外不得延伸到 A+B、CI workflow 或其他後續變更。

## 0. 先確立四個獨立狀態

開始新 point 時，Codex 先確認 working tree 與 default branch，從預定 base 建立或切換到 **non-default point branch**，在任何 Spec／實作 commit 前記錄 PR merge-base 為 point base。正常流程一個 point 對應一個 PR；不要直接在 default branch 累積 Spec 或 Green commits。

開始或恢復工作時，Codex 再明確指出：

1. Point manifest、Frozen Spec 的 path／freeze commit／trusted freeze ref。
2. 當前 point、slice 與 point base。
3. 當前模式及它已涵蓋的本機／外部操作授權。

作者來源可按 change／commit 記為人類、AI 或 mixed，但不影響任何 gate，也不必替整個 point 強貼單一作者標籤。

沒有另行指定時，預設為「委派本機工作」：Codex 可在使用者要求的 scope 內做可逆編輯、檢查與 Green commits；外部寫入與 merge 只在本次要求或其他明確授權已涵蓋時執行。找不到 Frozen Spec 時回到 Spec 流程。新 session 不能把「上次是全自動」推定成仍有 push／merge 授權。

## 1. Spec：拷問、Review、確認、凍結

1. Codex 先查 repository 與可查的外部事實，不把事實查找問題丟給使用者。
2. 需求、scope、驗收條件、風險取捨或 test seam 未定時，Codex 自動使用 `grilling`，分輪提出真正需要人類決定的 frontier，並附推薦答案。
3. 決策收斂後，Codex 產出 repository-owned Spec。最少包含：目的、in/out of scope、可觀察行為、acceptance criteria、錯誤與邊界案例、已確認 test seams、非功能限制、驗證方式及未決事項。
4. Codex 對 Spec 做一次獨立檢查：每個需求是否可驗收、術語是否一致、seam 是否足以測試、是否藏有未決決策。
5. 人類作最後確認。只有未決事項為零，且人類明確同意內容，才把狀態改為 `Frozen`，以 **Spec-only local commit** 凍結；該 commit 是 `freeze_sha`。
6. Codex 以獨立 commit 建立 `.ai-sdlc/points/<point-id>.json`。一個正常 PR 的 diff 必須只有一個 point manifest，最小 schema 為：

   ```json
   {
     "schema_version": 1,
     "point_id": "<point-id>",
     "spec": {
       "path": "<spec-path>",
       "freeze_sha": "<40-hex-sha>",
       "trusted_ref": "refs/tags/spec-freeze/<point-id>/<freeze-sha>"
     },
     "point_base": "<40-hex-pr-merge-base>"
   }
   ```

   `point_id` 必須符合 `^[a-z0-9][a-z0-9-]{0,62}$`，所以一定是單一路徑片段；`freeze_sha` 與 `point_base` 必須是 40 位小寫十六進位 commit SHA。`trusted_ref` 必須由這兩個已驗證值精確組成，不能接受任意 ref。

7. 人類對 Spec 的確認同時授權建立對應 trusted freeze ref；Codex 可先建立本機 annotated tag，只有進入 Push gate且取得外部寫入授權後才發布。第二階段要對精確 pattern `spec-freeze/*/*` 建立兩個同時生效的 tag rulesets：creation ruleset 啟用「Restrict creations」，只讓 trusted maintainer 作 bypass actor；immutability ruleset 啟用「Restrict updates」與「Restrict deletions」，**不設任何 bypass actor**。前者限制誰能建立，後者使已建立 ref 無人可移動或刪除；PR head workflow 不取得 creation 身分。
8. 人類與 Codex 顯示引用時使用 `<spec-path> @ <freeze-sha>`；自動化只讀 committed point manifest 與受保護 ref，不讀可任意編輯的 PR body 當權威來源。

Frozen Spec 不是「不能修正」，而是不能靜默修正。發現需求或 seam 必須改變時，中止當前 slice，修改 Spec、重新 Review、取得人類確認，產生新的 freeze commit 與新的 immutable trusted ref，再以新 commit 更新 point manifest；舊 tag 不移動。

## 2. 每個 slice：Red → Green → 相關檢查 → commit

對 point 中每個 vertical slice 依序執行：

1. 從 Frozen Spec 選一個 acceptance criterion 與已確認 seam，說明本 slice 的可觀察輸入與輸出。
2. 啟用 `tdd`。Frozen Spec 中的 seam 已算人類預先確認；若 seam 缺漏或語意有歧義，不在實作中自行補設計，回到 Spec change control。
3. 先寫一個會因缺少該行為而失敗的測試，執行它並確認是「正確原因的 Red」，不是語法、fixture 或環境錯誤。
4. 只寫足以讓這個測試通過的實作，執行到 Green；同一 slice 若還有下一個不可分割的行為例，重複「一個 Red 測試 → 最小 Green 實作」micro-cycle，不能先批量寫完所有測試。
5. 整個邏輯小階段 Green 後，執行相關 Format、Lint、Build、Test。formatter 若改檔，重新執行受影響檢查。
6. 檢查 scope 與 working tree，只把本階段相關檔案納入本機 Green commit。commit message 要能對應 point／slice；不把 Red 狀態當正常里程碑 commit。
7. 還有下一個 slice 就重複；不提前 Push。

`tdd` 只提供 Red → Green、public seam 與測試品質方法，不負責 commit、Push、full verify 或 Review。人類寫入、AI 寫入或共同完成的 slice 都走同一條路。

## 3. Point 完成：full verify 與 Push 前雙 Review

最後一個 slice Green commit 後：

1. 確認 working tree 乾淨，且 `point base..HEAD` 只包含本 point 的 committed changes。
2. 執行 canonical full local verify。真正命令由第二階段選定的技術棧寫入 repository scripts；本階段不捏造命令。
3. 依 [`REVIEWS.md`](REVIEWS.md) 對同一 `point base..HEAD` 與同一 Frozen Spec，分開執行 Implementation Review、Test Review。
4. 有 blocking finding 時在本機修正，執行相關檢查並建立新的 Green commit。只要 `HEAD` 改變，先前兩份 verdict 就不再涵蓋同一 range；必須重跑 full local verify、Implementation Review、Test Review 三者全部。
5. 只有 full verify 與兩種 Review 都為 `PASS`、working tree 乾淨，才進入 Push Approval Gate。

## 4. Push、GitHub 重驗、Merge

1. 取得當前模式要求的 Push／PR 授權後才發布 committed changes。
2. 發布 branch 與 manifest 指定的 trusted freeze tag。PR body 可顯示 `Point-Manifest: .ai-sdlc/points/<point-id>.json`，但 GitHub gate 自行從 PR committed diff 找出唯一 manifest，不信任 body 指標。
3. GitHub 驗證 manifest 的兩個 SHA 都存在且是 `HEAD` ancestor、`point_base` 等於 PR merge-base、protected trusted ref 精確指向 `freeze_sha`。Reviewer 以 `git show <freeze-sha>:<path>` 讀 Spec；若 `HEAD` 的同路徑內容不同，代表有未凍結修改，gate 直接失敗。
4. GitHub 在乾淨 runner 重新執行 deterministic checks、coverage、適用的供應鏈／安全分析與正式 AI Review。
5. 任一 check 失敗，不直接在 GitHub 上盲修：先讀證據，在本機重現、修正、Green commit、full local verify、雙 Review，再 Push。
6. required checks 與 review requirements 全部通過後，才可進 Merge Approval Gate；ruleset 不提供繞過者。

正常開發不得 amend／rebase 掉 freeze commit 或 point base。若 Spec 變更，走前述新 freeze commit／新 tag／manifest update；`point_base` 仍指向 PR merge-base，不能為了縮小 Review diff 而前移。base branch 變動導致 merge-base 改變時，先更新本機 branch與 committed manifest，再以新 range 重跑 full local verify 與雙 Review。

詳細 GitHub 契約見 [`CI-CD.md`](CI-CD.md)。

## 三種模式與 Approval Gates

模式是授權策略，不是品質策略。三種模式執行完全相同的 Spec、TDD、檢查、commit、Review、Push 後重驗與 Merge Gate。

| Gate | 監督模式 | 委派模式 | 全自動模式 |
|---|---|---|---|
| 人類需求決策與 Spec freeze | 人類決定 | 人類決定 | 人類決定 |
| 開始下一個 slice／套用本機修正 | 每個小階段先確認 | point 授權涵蓋的範圍內自動 | bounded objective 內自動 |
| 建立本機 Green commit | 每次先確認 | point 內自動 | bounded objective 內自動 |
| Push／建立或更新 PR | 每次先確認 | 另設發布 gate；取得一次明確授權後執行 | 只有初始授權明列此類外部寫入時自動 |
| GitHub failure 後修復與再次 Push | 每輪確認 | 本機修復可自動；再次發布受 Push gate 約束 | 授權範圍及 repair policy 內自動 |
| Merge | 每次明確確認 | 每次明確確認 | 只有初始授權明列 merge 且所有保護通過時自動 |

模式可在工作途中切換。切換內容至少要說明新模式、適用 point／slice、允許的外部操作與有效期間；從**下一個尚未通過的 gate** 生效，不回溯取消已取得的品質證據，也不替尚未授權的外部操作補授權。

## Gate Drill：唯一允許刻意跳過本機檢查的情況

Gate Drill 不屬於正常開發，必須同時符合：

- 由人類明確授權啟動，不能由 Codex 為展示效果自行製造 failure。
- 使用隔離的 `gate-drill/<purpose>` branch。
- Draft PR 標題以 `[GATE DRILL — DO NOT MERGE]` 開頭，說明唯一刻意跳過的本機 gate 與預期 GitHub failure。
- 不混入產品變更、不關閉 required check、不降低 threshold、不使用 bypass。
- 關閉 unattended repair，避免它自動消除要觀察的阻擋證據。
- 取得阻擋證據後保持不可合併；後續清理 branch／PR 另依授權執行。

正常 PR 的預期永遠是：本機綠、Push 前 Review 綠、GitHub 也綠。
