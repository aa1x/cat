# API 调用指南（catcs.v6.army）

本文档基于仓库中的 Cloudflare Pages Functions 实现整理，供外部系统直接调用。

- 基础域名：`https://catcs.v6.army`
- API 前缀：`/api`
- 数据库：Cloudflare D1（绑定名 `DB` 或 `CAT_DB`）
- 返回格式：`application/json`

---

## 数据与刷新口径

- UID：必须为 9 位数字。
- 服务器：API 根据 UID 自动推断，`1` 开头为 `官服`，`5` 开头为 `B服`。
- 猫糕：必须提交 3 个，且每个都必须在内置猫糕名称白名单内。
- 地点：必须为 `[]`，或 3 个不重复的内置地点。
- 每周刷新：上海时区每周一 04:00，写入和查询使用 `week_start`。
- 每日刷新：上海时区每天 04:00，阿基喵利写入和查询使用 `aji_date`。
- 唯一约束：`cat_cakes` 按 `uid + server + week_start` 唯一；`daily_aji` 按 `server + aji_date` 唯一。

---

## D1 初始化

首次部署请执行完整 schema：

```bash
npx wrangler d1 execute <DB_NAME> --file=sql/cloudflare_d1_schema.sql --remote
```

不要只复制单条 `CREATE INDEX`。如果只执行：

```sql
CREATE INDEX IF NOT EXISTS idx_admin_delete_audit_password_failed
  ON admin_delete_audit_logs (action, request_ip, id DESC);
```

而没有先创建表，会出现 `no such table: main.admin_delete_audit_logs`。如需单独补建审计表，可执行：

```bash
npx wrangler d1 execute <DB_NAME> --file=sql/admin_delete_audit.sql --remote
```

`admin-delete` 接口也包含运行时兜底建表与建索引逻辑。

---

## 1) 提交猫糕数据

- **接口**：`POST /api/cat-cakes`
- **用途**：提交某 UID 当前周的猫糕与位置数据。

### 请求体

```json
{
  "uid": "123456789",
  "cat_cakes": ["垃圾糕", "冰糕", "星辰拿铁"],
  "cat_locations": ["猫爬架旁桌上台灯", "吧台上固定电话", "车厢上中部沙发"]
}
```

`cat_locations` 可传空数组 `[]` 表示不提交地点。

### 成功响应

```json
{ "success": true }
```

### 常见错误

- `400`：JSON 非法、参数无效、猫糕/地点不在白名单内、重复提交触发唯一约束。
- `405`：仅允许 POST。
- `500`：D1 绑定缺失或服务端异常。

---

## 2) 按服务器查询本周猫糕记录

- **接口**：`GET /api/search?server=<server>`
- **用途**：查询指定服务器当前周记录（按 D1 `week_start` 查询）。

### Query 参数

- `server`：必填，只能为 `官服` 或 `B服`。

### 成功响应

```json
[
  {
    "id": 1,
    "uid": "123456789",
    "server": "官服",
    "cat_cakes": ["垃圾糕", "冰糕", "星辰拿铁"],
    "cat_locations": ["猫爬架旁桌上台灯", "吧台上固定电话", "车厢上中部沙发"],
    "created_at": "2026-05-11T00:00:00.000Z",
    "week_start": "2026-05-10T20:00:00.000Z"
  }
]
```

### 常见错误

- `400`：`server` 参数不是 `官服` 或 `B服`。
- `500`：D1 查询失败或服务端异常。

---

## 3) 查询本周唯一 UID 统计

- **接口**：`GET /api/weekly-count`
- **用途**：统计当前周（上海时区周一 04:00 起算）提交过猫糕记录的去重 UID 数量。

### 成功响应

```json
{ "count": 123 }
```

---

## 4) 每日阿基喵利查询 / 写入

同一路由支持 GET 与 POST：`/api/daily-aji`

### 4.1 查询当日阿基喵利 UID

- **接口**：`GET /api/daily-aji?server=<server>`
- **用途**：获取指定服务器当日（上海时区 04:00 切日）的 UID。

成功响应：

```json
{ "uid": "123456789" }
```

若无数据：

```json
{ "uid": null }
```

### 4.2 写入当日阿基喵利 UID

- **接口**：`POST /api/daily-aji`

请求体：

```json
{ "uid": "123456789" }
```

成功响应：

```json
{ "success": true }
```

常见错误：

- `400`：参数无效或当天该服务器已存在记录。
- `405`：仅允许 GET / POST。
- `500`：D1 绑定缺失或服务端异常。


### 4.3 举报当日阿基喵利 UID

- **接口**：`POST /api/aji-report`
- **用途**：举报当前展示的阿基喵利 UID。举报成功后该 UID 会从当日展示中隐藏，该服务器恢复为可上传状态。

请求体：

```json
{ "server": "官服", "uid": "123456789", "reason": "not_visitable" }
```

`reason` 可选值：

- `not_visitable`：未开启可拜访。
- `no_aji`：车厢无阿基喵利。

常见错误：

- `409` + `code: uid_valid_after_report`：该 UID 已在被举报后由管理员判定为有效，当日不可再次举报。

---

## 5) 管理删除接口

- **接口**：`POST /api/admin-delete`
- **用途**：删除指定 UID 记录、删除当日阿基喵利记录。每周过期猫糕记录由常规 API 自动清理，不再提供手动删除上周数据动作。
- **鉴权**：请求体必须携带 `password`，并匹配环境变量 `ADMIN_PASSWORD`。

### 请求体示例

```json
{ "action": "delete_uid", "uid": "123456789", "password": "你的管理密码" }
```

`action` 可选值：

- `delete_uid`：删除指定 UID 的猫糕记录。
- `delete_aji`：删除当前 `aji_date` 的阿基喵利记录。

### 安全行为

- 支持 `ADMIN_ALLOWED_ORIGIN` 限制来源。
- 对来源 IP 做基础限流。
- 密码错误会记录/更新 `admin_delete_audit_logs` 中的 `password_failed` 审计记录。
- 删除前会先查询待删除数据，再删除并写入审计日志。


## 6) 管理端阿基喵利举报接口

- **接口**：`POST /api/admin-report`
- **用途**：查询今日阿基喵利举报，并判定举报属实或为假。所有请求体都必须携带 `password`。

查询举报：

```json
{ "action": "list", "password": "你的管理密码" }
```

处理举报：

```json
{ "action": "resolve", "password": "你的管理密码", "report_id": 1, "resolution": "rejected" }
```

`resolution` 可选值：

- `accepted`：举报属实，保持该 UID 下架状态。
- `rejected`：举报为假，恢复被举报 UID，替换其下架后其他人上传的 UID，并使该 UID 当日不可再次举报。
