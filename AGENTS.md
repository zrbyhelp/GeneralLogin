# Repository Guidelines

## 项目结构
这是一个基于 Nuxt 3 + Prisma 的统一登录门户。页面路由放在 `pages/`，通用布局在 `layouts/`，可复用组件在 `components/`。接口与业务逻辑分别位于 `server/api/` 和 `server/utils/`，数据库结构定义在 `prisma/schema.prisma`。样式资源在 `assets/css/`，补充说明见 `docs/service-auth.md`。

## 构建与运行
先执行 `pnpm install` 安装依赖。
本地开发使用 `pnpm dev`，默认监听 `0.0.0.0`，便于局域网和内网访问。
生产构建使用 `pnpm build`，本地预览使用 `pnpm preview`。
数据库相关命令：`pnpm db:generate`、`pnpm db:push`、`pnpm db:migrate`、`pnpm db:backfill-accounts`、`pnpm db:studio`。文档使用 VitePress，运行 `pnpm docs:dev` 预览，`pnpm docs:build` 输出到 `public/docs`。

## 代码风格
沿用仓库现有写法：TypeScript、Vue SFC、2 空格缩进、双引号字符串。文件命名遵循 Nuxt 约定，例如 `pages/login.vue`、`server/api/admin/users.get.ts`。变量和函数尽量使用清晰的 camelCase 命名，单个模块保持小而专注。

## 测试与验证
当前未配置独立测试框架。修改后至少运行 `pnpm build`，并手动检查相关页面和接口，尤其是登录、后台和授权流程。新增测试时，请使用清晰的命名，例如 `*.spec.ts`，并尽量贴近被测代码。

## 提交与合并
提交信息保持简短、祈使句式，例如 `Fix login redirect`。PR 需要说明改了什么、影响哪些页面或接口、是否涉及 `.env` 或数据库结构；如果有 UI 改动，最好附截图。

## 配置提示
不要提交 `.env`，请以 `.env.example` 为模板。运行前重点检查 `DATABASE_URL`、`NUXT_ADMIN_ACCOUNTS`、`NUXT_ADMIN_EMAILS` 兼容项和 Linux.do OAuth 相关配置。密钥、口令和数据库凭据只保留在本地环境。
