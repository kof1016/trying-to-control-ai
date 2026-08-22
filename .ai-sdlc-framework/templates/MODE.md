Spec 已 Freeze。請為這項工作選擇執行模式：

1. `supervised`：每個外部寫入或交付動作前停止確認。
2. `delegated`：自動完成實作、驗證、Review、Push 與 PR；Merge 前停止確認。
3. `autonomous`：相同檢查全部通過後可自動 Merge。

模式只改變停下取得授權的時點，不改變 Spec、驗證、Review 或平台 gate。`preflight` 會對 supervised Publish 要求 `--authorization-source`；受信任 host 的 Merge 入口會對 supervised／delegated 要求同樣的明確授權，autonomous 才可在 gates 成立後直接 Merge。
