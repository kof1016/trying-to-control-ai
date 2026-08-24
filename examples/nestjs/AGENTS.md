# NestJS 範例規則

本檔只補充 `examples/nestjs/`；root `AGENTS.md` 仍然適用。

本範例使用 Node.js 26.7.0、TypeScript 7.0.2、NestJS 11.2.1 與 Jest 30.4.2。

## 建置與驗證

從本目錄執行：

```bash
npm ci
npm run verify
```

`verify` 會執行 TypeScript 嚴格模式編譯與型別檢查，再以 SWC 即時轉譯並由 Jest 直接執行 TypeScript 測試。
