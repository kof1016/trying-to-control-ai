# ASP.NET Core 範例規則

本檔只補充 `examples/aspnet-core/`；root `AGENTS.md` 仍然適用。

本範例使用 C# 14、.NET 10 LTS、ASP.NET Core Controller Web API 與 xUnit。

## 建置與驗證

從本目錄執行：

```bash
dotnet restore AspNetCore.slnx --locked-mode
dotnet format AspNetCore.slnx --no-restore --verify-no-changes
dotnet test AspNetCore.slnx --no-restore --configuration Release
```

第一次建立或刻意更新 NuGet dependency 時，先執行不含 `--locked-mode` 的 `dotnet restore AspNetCore.slnx`，並提交更新後的 `packages.lock.json`。
