<!-- ai-sdlc-framework:begin -->
## AI-SDLC

1. 先執行 `node .ai-sdlc-framework/bin/ai-sdlc.mjs check-install`。
2. 再執行 `node .ai-sdlc-framework/bin/ai-sdlc.mjs inspect`，只採用回傳的 `nextAction`。
3. `setup-project` 載入同名 Skill；`define-requirement` 或 `spec-change-needed` 載入 `define-requirement`；`implement-change` 或 `verify` 載入 `implement-change`；`review-change` 載入同名 Skill。
4. `choose-mode` 使用固定模式提示；需要跨 Session 備份時可先 Push 目前 feature branch，但不開 PR、不要求 CI。`deliver` 依 `deliveryPolicy` 取得需要的明確授權，先執行 publish preflight，再使用受信任的平台 Adapter。
5. Frozen Spec、驗證或 Review 證據不一致時 fail closed，不以對話記憶補寫狀態；Repository 內更具體的安全、技術與交付規則優先。
<!-- ai-sdlc-framework:end -->
