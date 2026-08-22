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

## GitHub 即時結果

- Configured checks：<名稱與結果>
- Required checks：<名稱與結果；未設定時寫 `none`>
- Unresolved review threads：<數量>
- Conflicts／mergeability：<結果>

## Merge gate

- [ ] PR Head 等於最新 verified Head。
- [ ] 最新 Head 有 append-only AI-SDLC evidence comment。
- [ ] 實際 Required Checks 已完成且成功（若未設定則明確記錄）。
- [ ] PR 已轉 Ready，且沒有 outstanding changes request、未解決 blocking thread 或 conflict。
