# A+B HTTP API

狀態：Confirmed

## 目標

提供一個無狀態 HTTP API，接收兩個 32-bit 有號整數並回傳加總結果。API 必須明確驗證 JSON 契約、拒絕無效輸入與整數溢位，並以一致且可由程式判斷的 Problem Details 錯誤回應呈現失敗原因。

## 可驗收條件

- [ ] `POST /api/add` 接受 `application/json` request body：`{"a": 2, "b": 3}`。
- [ ] 成功時回傳 `200 OK`、`application/json` 與 `{"result": 5}`。
- [ ] `a`、`b` 都是必填且不可為 `null` 的 32-bit 有號整數；完整範圍內的正數、負數與零皆可使用。
- [ ] JSON 字串、小數、無法精確表示整數的科學記號，以及超出 32-bit 範圍的數字，回傳 `400 Bad Request` 與 `INVALID_OPERAND`。
- [ ] 科學記號只有在其數學值能精確表示整數且位於 32-bit 範圍內時才接受。
- [ ] 空 body、格式錯誤的 JSON、非 JSON object、缺少欄位、`null`、未知欄位、大小寫錯誤欄位與重複 key，回傳 `400 Bad Request` 與 `INVALID_OPERAND`。
- [ ] 兩個有效輸入的加總若超出 32-bit 有號整數範圍，回傳 `400 Bad Request` 與 `INTEGER_OVERFLOW`，不得發生整數環繞。
- [ ] `Content-Type` 不是 `application/json` 或未提供時，回傳 `415 Unsupported Media Type` 與 `UNSUPPORTED_MEDIA_TYPE`。
- [ ] 對 `/api/add` 使用非 POST 方法時，回傳 `405 Method Not Allowed` 與 `METHOD_NOT_ALLOWED`。
- [ ] 所有錯誤使用 `application/problem+json`，並包含 `type`、`title`、`status`、`detail`、`instance` 與 `code`；呼叫端的穩定判斷契約是 HTTP status 與 `code`，`detail` 只供人閱讀。
- [ ] HTTP 整合測試實際經過 Spring MVC、JSON parsing、validation、錯誤處理與 response serialization，涵蓋成功與所有公開錯誤契約。
- [ ] 核心 Unit Test 直接驗證一般加法、負數、零、正向溢位與負向溢位。

## 輸入、輸出與公開介面

### 成功請求

```http
POST /api/add
Content-Type: application/json
Accept: application/json
```

```json
{
  "a": 2,
  "b": 3
}
```

### 成功回應

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "result": 5
}
```

### 錯誤回應

錯誤回應遵循 Problem Details 結構。以下為無效運算元範例：

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json
```

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "Request operands are invalid.",
  "instance": "/api/add",
  "code": "INVALID_OPERAND"
}
```

`title` 應符合 HTTP status 的標準名稱；`detail` 可依實際失敗原因提供人類可讀資訊，但不是穩定比對欄位。

### 錯誤矩陣

| 情境 | HTTP status | `code` |
| --- | --- | --- |
| 空 body、格式錯誤 JSON、非 object | `400 Bad Request` | `INVALID_OPERAND` |
| 缺少 `a`／`b`、`null`、未知或大小寫錯誤欄位、重複 key | `400 Bad Request` | `INVALID_OPERAND` |
| 字串、小數、非整數科學記號、超出 32-bit 範圍 | `400 Bad Request` | `INVALID_OPERAND` |
| 有效運算元的加總溢位 | `400 Bad Request` | `INTEGER_OVERFLOW` |
| `Content-Type` 缺少或不是 `application/json` | `415 Unsupported Media Type` | `UNSUPPORTED_MEDIA_TYPE` |
| `/api/add` 使用非 POST 方法 | `405 Method Not Allowed` | `METHOD_NOT_ALLOWED` |

## 邊界與錯誤處理

- 最小輸入為 `-2147483648`，最大輸入為 `2147483647`。
- `2147483647 + 0` 與 `-2147483648 + 0` 必須成功。
- `2147483647 + 1` 必須回傳 `INTEGER_OVERFLOW`。
- `-2147483648 + -1` 必須回傳 `INTEGER_OVERFLOW`。
- `0 + 0`、正負相消及兩個負數的非溢位加法必須正確。
- `{"a": 2e1, "b": -3}` 的數值可精確表示整數且在範圍內，應成功回傳 `17`。
- `{"a": 2e-1, "b": 3}` 無法表示整數，應回傳 `INVALID_OPERAND`。
- JSON member name 區分大小寫；只有精確的 `a` 與 `b` 有效。
- `detail` 不作為測試或呼叫端的穩定判斷依據；測試應以 HTTP status 與 `code` 驗證錯誤種類。

## 非目標

- 不提供 UI、CLI 或 Java 對外 Library 介面。
- 不加入資料庫、歷史紀錄、登入、授權或其他持久化狀態。
- 不支援小數、任意精度整數、批次運算或加法以外的運算。
- 不新增 OpenAPI／Swagger 文件或 API 版本管理。
- 不定義與本端點契約無關的全域 API 政策；例如其他未來端點的 JSON 嚴格程度與錯誤代碼。
- 不額外規範未列入驗收條件的內容協商、尾端斜線或代理伺服器行為，沿用 Spring MVC 預設行為。

## 驗證方式

- TDD：每個可獨立驗收行為先建立會因功能尚未存在而正確失敗的測試，再以最小實作使其通過。
- 核心 Unit Test：一般正數、負數、零、邊界成功、正向溢位與負向溢位。
- HTTP 整合測試：成功契約、必要欄位、`null`、型別與範圍、科學記號、未知／大小寫錯誤／重複欄位、空或 malformed body、錯誤媒體類型、錯誤方法及所有 Problem Details `code`。
- 完整驗證：執行 Repository 規定的 Maven Wrapper `verify`，確認 Spotless、編譯警告、測試、Build 與 JaCoCo report 全部成功。
- Implementation Review：確認實作沒有超出本 Spec，且所有錯誤路徑都映射到指定 status、media type 與 `code`。
- Test Review：確認測試實際通過公開 HTTP seam 或直接執行核心計算，不只驗證 Mock 互動，也不複製實作邏輯。

## 決策紀錄

| 問題 | 已確認決策 | 理由 |
| --- | --- | --- |
| Q1 公開介面 | HTTP API | 專案已有 Spring Web MVC，可直接驗證公開輸入、輸出與錯誤行為。 |
| Q2 數值範圍 | 32-bit 有號整數，溢位報錯 | 範圍清楚並能形成有意義的邊界測試。 |
| Q3 功能範圍 | 僅無狀態加法 | 將第一次試跑重點維持在完整交付流程。 |
| Q4 HTTP method | `POST /api/add`，JSON body | 符合使用者原始意圖，亦適合 request-body validation。 |
| Q5 負數與零 | 接受完整 32-bit 範圍 | 加法沒有只允許正數的需求。 |
| Q6 錯誤契約 | Problem Details；區分 `INVALID_OPERAND` 與 `INTEGER_OVERFLOW` | 讓呼叫端以穩定代碼辨識失敗。 |
| Q7 欄位契約 | `a`、`b` 必填且不可為 `null`；拒絕額外欄位 | 及早發現缺漏與拼字錯誤。 |
| Q8 JSON 數字 | 僅接受能精確表示 32-bit 整數的 JSON number | 不默默轉換字串或截斷小數。 |
| Q9 HTTP 層錯誤 | 內容錯誤 `400`、媒體類型錯誤 `415`、方法錯誤 `405` | 保留各 HTTP status 的精確語意。 |
| Q10 Problem Details 欄位 | 固定標準欄位與 `code`；`detail` 非穩定契約 | 兼顧標準格式與程式判斷。 |
| Q11 JSON 嚴格性 | 拒絕重複 key 與大小寫錯誤欄位 | 避免伺服器默默選值或忽略錯字。 |
| Q12 媒體類型 | 成功為 `application/json`，錯誤為 `application/problem+json` | 讓成功與錯誤內容明確且可測。 |
| Q13 HTTP 錯誤代碼 | `UNSUPPORTED_MEDIA_TYPE`、`METHOD_NOT_ALLOWED` | 讓所有公開錯誤都有一致穩定代碼。 |
| Q14 測試接縫 | HTTP 整合測試加核心 Unit Test | 分別保證公開契約及精確定位核心計算錯誤。 |

## 未決事項

- 無。

---

使用者確認後，將狀態改為 `Confirmed`。如果後續必須改變可觀察行為，先更新本文件並重新確認，再繼續實作。
