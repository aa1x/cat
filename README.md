# cat

`cat` 是一个部署在 **Cloudflare Pages + Pages Functions + Cloudflare D1** 上的轻量站点，用于收集、查询和维护《崩坏：星穹铁道》猫猫糕与每日阿基喵利相关数据。

项目包含静态前端页面、管理页面、Cloudflare Pages Functions API、D1 数据库 schema 与时间边界校验脚本。

## 功能概览

- 前台页面：提交 UID、本周 3 个猫猫糕与可选地点；按服务器查看本周数据；查看本周去重 UID 数量。
- 猫猫糕标记：用户可对本周搜索结果标记“未开启可拜访”“地点信息错误”“猫猫糕信息错误”。
- 每日阿基喵利：按服务器提交 / 查询每日阿基喵利 UID，并支持用户举报。
- 管理后台：删除指定 UID 的猫猫糕记录、删除今日阿基喵利记录、处理阿基喵利举报。
- 站点公告：从 D1 中读取最新启用公告并在前台展示。
- 自动清理：常规 API 会清理非当前周猫猫糕数据、非当前日阿基喵利数据及过期举报 / 标记数据。

## 技术栈

- 静态前端：原生 HTML / CSS / JavaScript。
- 服务端：Cloudflare Pages Functions。
- 数据库：Cloudflare D1（SQLite 兼容）。
- 部署：Cloudflare Pages。

## 项目结构

```text
.
├── index.html                         # 前台页面
├── styles.css                         # 全站样式
├── API调用指南.md                      # API 调用说明
├── admin/
│   ├── index.html                     # 管理删除页面（/admin）
│   └── report/index.html              # 阿基喵利举报处理页面（/admin/report）
├── functions/api/
│   ├── _aji-reports.js                # 阿基喵利举报表、原因与清理工具
│   ├── _cat-cake-marks.js             # 猫猫糕标记表、原因与清理工具
│   ├── _cleanup.js                    # 当前周 / 当前日数据清理工具
│   ├── _db.js                         # D1 绑定、校验、JSON 编解码工具
│   ├── _time.js                       # 上海时区 04:00 周 / 日边界工具
│   ├── admin-delete.js                # 管理删除接口
│   ├── admin-report.js                # 管理端阿基喵利举报查询与判定接口
│   ├── aji-report.js                  # 用户端阿基喵利举报接口
│   ├── announcement.js                # 站点公告读取接口
│   ├── cat-cake-mark.js               # 猫猫糕结果标记接口
│   ├── cat-cakes.js                   # 猫猫糕提交接口
│   ├── daily-aji.js                   # 每日阿基喵利查询 / 写入接口
│   ├── search.js                      # 本周猫猫糕查询接口
│   └── weekly-count.js                # 本周去重 UID 统计接口
├── image/                             # 猫猫糕与阿基喵利图片资源
├── ico/                               # favicon 资源
├── scripts/verify-week-boundary.mjs   # 上海时区 04:00 边界校验脚本
└── sql/
    ├── cloudflare_d1_schema.sql       # 完整 D1 schema
    └── admin_delete_audit.sql         # 管理删除审计表兜底脚本
```

## API 路由

所有接口位于 Cloudflare Pages Functions 的 `/api` 前缀下：

| 路由 | 方法 | 用途 |
| --- | --- | --- |
| `/api/cat-cakes` | `POST` | 提交当前周猫猫糕与地点数据 |
| `/api/search?server=官服或B服` | `GET` | 查询指定服务器当前周猫猫糕记录 |
| `/api/weekly-count` | `GET` | 查询当前周去重 UID 数量 |
| `/api/cat-cake-mark` | `POST` | 标记某条当前周猫猫糕搜索结果 |
| `/api/daily-aji?server=官服或B服` | `GET` | 查询指定服务器当日阿基喵利 UID |
| `/api/daily-aji` | `POST` | 写入当日阿基喵利 UID |
| `/api/aji-report` | `GET` / `POST` | 查询 UID 是否已判定有效、提交阿基喵利举报 |
| `/api/admin-delete` | `POST` | 管理删除指定 UID 记录或今日阿基喵利记录 |
| `/api/admin-report` | `POST` | 管理端查询 / 处理阿基喵利举报 |
| `/api/announcement` | `GET` | 读取最新启用站点公告 |

更完整的请求体、响应体与错误说明见 [`API调用指南.md`](API调用指南.md)。

## 数据规则

- UID 必须是 9 位数字。
- UID 以 `1` 开头自动归为 `官服`，以 `5` 开头自动归为 `B服`。
- 猫猫糕必须一次提交 3 个，且名称必须在代码与 D1 schema 的白名单内。
- 地点可提交空数组 `[]`，或提交 3 个互不重复的内置地点。
- 猫猫糕记录按 `uid + server + week_start` 唯一；同一 UID 同一服务器同一周只能提交一次。
- 猫猫糕标记按 `uid + server + week_start + reason_code` 唯一。
- 每日阿基喵利按 `server + aji_date` 唯一；每个服务器每天只能有一条当日记录。
- 被管理员判定为有效的阿基喵利 UID，在同一 `aji_date` 内不可再次被举报。
- 每周刷新点：上海时区每周一 04:00。
- 每日刷新点：上海时区每天 04:00。

## 环境变量与绑定

在 Cloudflare Pages 或 Wrangler 中配置：

- D1 绑定：`DB`（推荐）或 `CAT_DB`。
- `ADMIN_PASSWORD`：管理删除与举报处理接口密码。
- `ADMIN_ALLOWED_ORIGIN`：可选，限制管理接口允许的 `Origin`。

## D1 初始化

首次部署请执行完整 schema：

```bash
npx wrangler d1 execute <DB_NAME> --file=sql/cloudflare_d1_schema.sql --remote
```

如果只需要补建管理删除审计表，可执行：

```bash
npx wrangler d1 execute <DB_NAME> --file=sql/admin_delete_audit.sql --remote
```

请不要只复制某一条 `CREATE INDEX` 执行。完整 schema 已包含猫猫糕、猫猫糕标记、每日阿基喵利、阿基喵利举报、有效 UID、管理删除审计与公告相关表及索引。部分接口也会在运行时兜底创建自身依赖的表和索引。

## 本地开发与校验

本仓库当前没有 `package.json`，可直接使用 Wrangler 预览 Cloudflare Pages 项目：

```bash
npx wrangler pages dev .
```

校验上海时区 04:00 周 / 日边界逻辑：

```bash
node scripts/verify-week-boundary.mjs
```

如需连接 D1，请在 Wrangler 配置中绑定 `DB` 或 `CAT_DB`。

## 部署到 Cloudflare Pages

1. 在 Cloudflare Pages 中关联该 Git 仓库。
2. 构建输出目录设置为仓库根目录（静态页面与 `functions/` 同目录）。
3. 创建并绑定 D1 数据库，绑定名使用 `DB` 或 `CAT_DB`。
4. 配置 `ADMIN_PASSWORD`，按需配置 `ADMIN_ALLOWED_ORIGIN`。
5. 执行 `sql/cloudflare_d1_schema.sql` 初始化数据库。
6. 推送到部署分支后由 Cloudflare Pages 自动发布。

## 安全注意事项

- 不要提交 `.env`、密钥、凭证 JSON 或真实管理密码。
- 敏感信息应通过 Cloudflare 的 Secret / Environment Variables 管理。
- 管理页面不在前台放置入口，仍建议配合 `ADMIN_ALLOWED_ORIGIN`、强密码和更严格的访问控制使用。
- 管理删除接口会记录删除行为与密码错误审计信息。

## 许可证

本项目使用仓库中的 [`LICENSE`](LICENSE)。
