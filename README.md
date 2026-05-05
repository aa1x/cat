# Cat

一个基于 **Cloudflare Pages Functions** 的轻量站点与 API 项目，包含前端页面与若干服务端接口（通过 Supabase 存取数据）。

## 项目结构

- `index.html`：前端页面入口。
- `functions/api/`：Cloudflare Pages Functions API。
  - `cat-cakes.js`：写入猫猫糕相关数据。
  - `search.js`：按条件查询数据。
  - `weekly-count.js`：统计上周数据。
  - `daily-aji.js`：每日阿基喵利相关读写接口。
  - `admin-delete.js`：管理删除接口（需密码与来源校验）。
  - `_time.js`：时间工具函数。
- `scripts/verify-week-boundary.mjs`：周边界校验脚本。
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

## 环境变量

请在 Cloudflare Pages / Wrangler 环境中配置以下变量（不要写入仓库）：

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `ADMIN_PASSWORD`（`admin-delete` 接口需要）
- `ADMIN_ALLOWED_ORIGIN`（可选，限制管理接口来源）

## 安全建议

- 不要提交 `.env`、密钥文件、凭证 JSON。
- 通过平台 Secret/Environment Variables 管理敏感信息。
- 管理接口建议仅在受信任来源调用，并启用更严格鉴权策略。

## 部署

推荐使用 Cloudflare Pages：

1. 关联 Git 仓库。
2. 构建输出目录设置为仓库根目录（静态页面 + `functions/`）。
3. 在项目设置中配置上面的环境变量。
4. 推送到主分支后自动部署。

## 许可证

本项目使用仓库中的 `LICENSE`。
