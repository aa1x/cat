# cat

一个基于 **Cloudflare Pages Functions + Cloudflare D1** 的轻量站点与 API 项目，包含前端页面与服务端接口。

## 项目结构

- `index.html`：前端页面入口。
- `styles.css`：页面样式。
- `functions/api/`：Cloudflare Pages Functions API。
  - `cat-cakes.js`：写入猫糕相关数据。
  - `search.js`：按服务器查询当前周数据。
  - `weekly-count.js`：统计当前周去重 UID。
  - `daily-aji.js`：每日阿基喵利读写接口。
  - `aji-report.js`：每日阿基喵利举报接口。
  - `admin-report.js`：管理端举报查询与判定接口（需密码）。
  - `admin-delete.js`：管理删除接口（需密码与来源校验），供 `/admin` 管理界面调用。
  - `_db.js`：D1 绑定、JSON 编解码与严格校验工具。
  - `_time.js`：上海时区 04:00 周/日刷新工具。
- `sql/cloudflare_d1_schema.sql`：Cloudflare D1 完整建表脚本。
- `admin/index.html`：独立管理界面（访问 `/admin`，不会在用户界面放置入口）。
- `admin/report/index.html`：阿基喵利举报处理界面。
- `sql/admin_delete_audit.sql`：仅审计表与索引的 D1 兜底脚本。
- `scripts/verify-week-boundary.mjs`：每周 / 每日 04:00 边界校验脚本。
- `image/`、`ico/`：静态资源。

## 本地开发

> 先确保已安装 Node.js（建议 LTS）与 npm。

1. 安装依赖（如果你后续补充 `package.json`）：
   ```bash
   npm install
   ```
2. 使用 Cloudflare Wrangler 本地预览（示例）：
   ```bash
   npx wrangler pages dev .
   ```

## Cloudflare D1 初始化

请执行完整 D1 schema，而不是只复制其中某一条 `CREATE INDEX`：

```bash
npx wrangler d1 execute <DB_NAME> --file=sql/cloudflare_d1_schema.sql --remote
```

如果只需要补建管理删除审计表，可执行：

```bash
npx wrangler d1 execute <DB_NAME> --file=sql/admin_delete_audit.sql --remote
```

`admin-delete` 接口也会在运行时兜底创建 `admin_delete_audit_logs` 表和索引，避免只执行索引语句时出现 `no such table: main.admin_delete_audit_logs`。阿基喵利举报表也会在相关接口运行时兜底创建。管理界面仅保留删除指定 UID 记录和删除今日阿基喵利数据；每周过期数据、前一天阿基喵利及前一天阿基喵利举报由常规 API 自动清理。

## 环境变量 / 绑定

请在 Cloudflare Pages / Wrangler 中配置：

- D1 绑定：`DB`（推荐）或 `CAT_DB`。
- `ADMIN_PASSWORD`（`admin-delete` 与 `admin-report` 接口需要）。
- `ADMIN_ALLOWED_ORIGIN`（可选，限制管理接口来源）。


## 数据约束

- UID 必须是 9 位数字。
- UID 以 `1` 开头自动归为 `官服`，以 `5` 开头自动归为 `B服`。
- 猫糕数组必须正好 3 个，且名称必须在内置白名单内。
- 地点数组必须为空数组，或正好 3 个不重复的内置地点。
- 猫糕记录按 `week_start` 去重：同一 `uid + server + week_start` 只能写入一次。
- 每日阿基喵利按 `server + aji_date` 去重：每个服务器每天只能写入一次。
- 阿基喵利举报仅保留当前 `aji_date`；被管理员判定为有效的 UID 当日不可再次举报。
- 每周刷新点：上海时区每周一 04:00。
- 每日刷新点：上海时区每天 04:00。

## 安全建议

- 不要提交 `.env`、密钥文件、凭证 JSON。
- 通过平台 Secret/Environment Variables 管理敏感信息。
- 管理接口建议仅在受信任来源调用，并启用更严格鉴权策略。

## 部署

推荐使用 Cloudflare Pages：

1. 关联 Git 仓库。
2. 构建输出目录设置为仓库根目录（静态页面 + `functions/`）。
3. 绑定 D1 数据库，并配置上面的环境变量。
4. 执行完整 D1 schema 初始化。
5. 推送到主分支后自动部署。

## 许可证

本项目使用仓库中的 `LICENSE`。
