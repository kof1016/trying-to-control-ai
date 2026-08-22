# 整數 A+B

## 背景

Spring Boot 範例目前只有可啟動的應用程式，尚未提供產品行為。本需求加入一個可經 HTTP 使用的 A+B 功能。

## 目標

呼叫者提供兩個十進位整數後，可以取得兩者相加的整數結果。

## 可觀察行為與驗收條件

- [ ] `GET /add?a=2&b=3` 回應 HTTP 200，JSON body 為 `{"result":5}`。
- [ ] 加數可為零或負整數；例如 `a=-4`、`b=1` 時結果為 `-3`。
- [ ] 缺少 `a` 或 `b`，或任一參數不是有效整數時，回應 HTTP 400。

## 錯誤與邊界

- 輸入與結果採 Java 32-bit signed integer；相加超出此範圍時回應 HTTP 400，不回傳溢位後的錯誤數值。

## 非目標

- 不支援加法以外的運算。
- 不保存計算紀錄，也不提供 UI、認證或外部整合。

## 必要技術限制

- 沿用目標專案既有 Spring Boot、Java 與 Maven 工具鏈。
- Controller 僅處理 HTTP transport；核心加法行為放在可直接測試的 concrete Service。

## 假設與決策

- 原始需求未指定 HTTP 契約；在 autonomous 模式採用最小的 query-parameter endpoint `GET /add`，回應以具名欄位呈現結果。
- `a` 與 `b` 解讀為十進位整數，以保持第一版契約簡單且明確。
