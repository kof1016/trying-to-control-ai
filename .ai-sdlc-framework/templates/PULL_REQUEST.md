## Work 與 Spec

- Work：`<work-id>`
- Frozen Spec commit：`<sha>`
- Spec SHA-256：`<sha256>`
- Mode：`<supervised|delegated|autonomous>`

## 變更

- <摘要>

## 本機證據

- Verified head：`<sha>`
- Verification：<實際命令與結果>
- Implementation Review：<PASS/BLOCKED 與 findings>
- Test Review：<PASS/BLOCKED 與 findings>

## GitHub

- Configured checks：<實際查詢結果>
- Required checks：<實際查詢結果；未設定時明確寫 none>
- Review threads／conflicts：<結果>

<!-- 最新 Head 的完整 evidence 由 GitHub Adapter 另加 append-only comment。 -->

## Merge gate

- [ ] PR Head 與 base branch／SHA 都等於本機驗證對象。
- [ ] PR 已轉 Ready，且最新 Head 有受信任 Adapter identity 的 exact evidence comment。
- [ ] 實際 Required Checks 已完成並為平台可接受結果（未設定時為 none）。
- [ ] 沒有 outstanding changes request、未解決 review thread 或 conflict。
