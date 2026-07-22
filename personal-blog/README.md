# Knowledge Log

一个前后端分离的个人知识博客。公开端用于阅读、搜索、归档和邮箱订阅；单管理员后台用于写作、发布、归档恢复、修订回溯、站点设置、订阅名单与审计。

## 功能

- 公开博客：分类、标签、全文搜索、排序、分页、文章详情、关联阅读和时间归档
- 写作流程：草稿、发布、下架、归档、恢复、实时预览、本地自动保存和版本冲突保护
- 内容安全：每次保存生成修订记录，可从历史版本恢复；永久删除只允许已归档文章并要求标题确认
- 管理后台：文章工作台、站点设置、订阅名单、操作审计和 JSON 内容备份
- 读者订阅：邮箱校验、主题记录、不可猜测退订令牌和安全退订
- 体验：桌面/移动响应式界面、深浅主题、键盘搜索、清晰加载/错误/空状态
- 安全：HttpOnly Cookie、会话令牌哈希、Origin 校验、SameSite、登录/写入限流、请求体限制、统一错误码和请求 ID
- 数据：本地 SQLite；Vercel 生产环境使用 Turso/libSQL 持久数据库

## 技术架构

```text
personal-blog/
  apps/
    api/src/
      core/             # HTTP、错误、日志、安全、限流、路由
      db/               # libSQL 客户端、迁移、种子和迁移命令
      modules/          # auth、posts、site、subscriptions、audit、admin
      app.js            # API 组合入口
      server.js         # 本地 HTTP 服务
      api.test.js       # 临时数据库上的完整 HTTP 测试
    web/src/
      app/              # 路由和通用 hooks
      features/admin/   # 后台页面与写作编辑器
      pages/            # 公开页面
      shared/           # 共享组件、内容工具和默认配置
      App.jsx           # 应用组合入口
  api/[...path].js      # Vercel Function 入口
  docs/                 # 架构、迁移和部署说明
```

详细设计见 [架构说明](./docs/ARCHITECTURE.md) 和 [迁移与部署](./docs/MIGRATION_AND_DEPLOYMENT.md)。

## 本地开发

要求 Node.js 22 LTS（`22.x`）。

```bash
npm install
npm run db:migrate
npm run dev
```

- Web：`http://127.0.0.1:5173/`
- API：`http://127.0.0.1:4174/`
- 登录：`http://127.0.0.1:5173/login`

未创建 `.env` 时，本地开发账号为 `admin` / `admin123456`。公网环境不会启用默认账号。

生产或长期使用前，将 `.env.example` 复制为 `.env` 并至少配置：

```dotenv
ADMIN_USERNAME=your-admin-name
ADMIN_PASSWORD=your-strong-password
SESSION_SECRET=a-random-secret-with-at-least-32-characters
```

## 命令

```bash
npm run dev          # 同时启动前端与 API
npm run db:migrate   # 执行待处理迁移并显示版本
npm run test         # 临时数据库上的 12 段 API 流程测试
npm run build        # Vite 生产构建
npm run check        # 测试 + 构建
```

## 数据与备份

- 本地数据库：`apps/api/data/blog.sqlite`
- 初始文章种子：`apps/api/data/content.json`
- 数据库首次迁移及后续版本升级前，会自动生成 `blog.sqlite.backup-<timestamp>`
- 后台“导出备份”会下载文章、站点设置和订阅名单，不包含会话令牌、退订令牌哈希或审计中的敏感内部字段
- 旧 `content.json` 只在文章表为空时导入，不会覆盖已经编辑过的内容

## 部署到 Vercel

Vercel Function 的临时文件系统不再作为数据库。生产部署必须连接 Turso：

1. 在 Vercel Marketplace 为项目安装 Turso Cloud。
2. 确认项目获得 `TURSO_DATABASE_URL` 和 `TURSO_AUTH_TOKEN`。
3. 配置 `ADMIN_USERNAME`、`ADMIN_PASSWORD`、`SESSION_SECRET` 和正式域名对应的 `ALLOWED_ORIGINS`。
4. 部署后访问 `/api/health`，确认 `provider` 为 `turso`、`migrationCurrent` 为 `true`。

缺少 Turso 时，公开首页、搜索和文章详情会使用打包的种子文章进入只读模式；登录、订阅和管理写入仍会明确返回 `DATABASE_NOT_CONFIGURED`。系统不会悄悄写入 `/tmp` 并造成数据丢失。

## 主要 API

公开接口：

- `GET /api/health`
- `GET /api/site`
- `GET /api/posts?page=&pageSize=&query=&filter=&nav=&sort=`
- `GET /api/posts/:slug`
- `POST /api/subscriptions`
- `POST /api/subscriptions/:id/unsubscribe`

管理员接口：

- `POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me`
- `POST /api/posts`、`PUT /api/posts/:id`
- `POST /api/posts/:id/archive`、`POST /api/posts/:id/restore`
- `GET /api/posts/:id/revisions`、`POST /api/posts/:id/revisions/:version/restore`
- `GET /api/admin/dashboard`、`GET|PUT /api/admin/settings`
- `GET /api/admin/subscriptions`、`GET /api/admin/audit`、`GET /api/admin/export`

所有错误响应都包含稳定 `code` 与 `requestId`；文章更新可携带 `version`，冲突时返回 `409 POST_VERSION_CONFLICT`。
