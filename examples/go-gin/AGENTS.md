# Go Gin 範例規則

本檔只補充 `examples/go-gin/`；root `AGENTS.md` 仍然適用。

本範例使用 Go 1.27.0 與 Gin 1.12.0。

## 建置與驗證

從本目錄執行：

```bash
go test ./...
go build ./...
```

提交前另執行 `gofmt -l .`，輸出必須為空。
