# ZR-AI服务

Nuxt 统一登录门户，内置账号密码注册登录和 Linux.do 第三方登录，MySQL + Prisma 保存用户状态、邀请码、网站服务、授权记录和反馈内容，后台 UI 使用 Element Plus。

## 快速启动

当前线上地址：

- 门户：`https://zrg.zrbyhelp.com/`
- MinIO：`https://minio.zrbyhelp.com`

1. 安装依赖：

```bash
pnpm install
```

2. 配置环境变量：

```bash
cp .env.example .env
```

重点变量：

- `DATABASE_URL`: MySQL 连接串
- `NUXT_ADMIN_ACCOUNTS`: 管理员账号，多个用英文逗号分隔
- `NUXT_ADMIN_EMAILS`: 旧邮箱管理员兼容配置，可选
- `NUXT_PUBLIC_APP_URL`: 门户公网地址，线上为 `https://zrg.zrbyhelp.com`
- `NUXT_LINUXDO_CLIENT_ID`: Linux.do Connect 应用 Client ID
- `NUXT_LINUXDO_CLIENT_SECRET`: Linux.do Connect 应用 Client Secret
- `NUXT_LINUXDO_REDIRECT_URI`: Linux.do 回调地址，线上为 `https://zrg.zrbyhelp.com/api/auth/linuxdo/callback`
- `NUXT_LINUXDO_SCOPE`: 可选，Linux.do Connect 应用需要 scope 时再填写
- `NUXT_LINUXDO_AUTHORIZE_URL` / `NUXT_LINUXDO_TOKEN_URL` / `NUXT_LINUXDO_USER_URL`: 可选，覆盖 Linux.do OAuth 端点
- `NUXT_MINIO_ENDPOINT` / `NUXT_MINIO_PORT`: MinIO 地址和端口，线上 endpoint 为 `minio.zrbyhelp.com`
- `NUXT_MINIO_ACCESS_KEY` / `NUXT_MINIO_SECRET_KEY`: MinIO 访问凭据
- `NUXT_MINIO_BUCKET`: 用户头像和第三方上传文件使用的 bucket
- `NUXT_MINIO_PUBLIC_BASE_URL`: 外部可访问的 bucket 地址，用于生成头像和文件 URL，线上可配置为 `https://minio.zrbyhelp.com/zr-access-portal`

3. 启动本地 MySQL 和 MinIO：

```bash
docker compose up -d mysql minio
```

4. 初始化数据库：

```bash
pnpm db:push
pnpm db:backfill-accounts
```

5. 启动开发服务：

```bash
pnpm dev
```

## Docker Compose 启动

复制环境变量后直接构建并启动：

```bash
cp .env.example .env
docker compose up -d --build
```

Compose 会启动 `app`、`mysql`、`minio` 和 `minio-init`。应用容器启动时默认执行 `prisma db push --accept-data-loss --skip-generate` 和账号回填脚本；稳定部署后可在 `.env` 中设置 `DB_PUSH_ON_START=false`、`DB_BACKFILL_ACCOUNTS_ON_START=false` 关闭自动同步。

默认入口：

- 门户：`http://localhost:3000`
- MinIO API：`http://localhost:9000`
- MinIO Console：`http://localhost:9001`

线上部署入口：

- 门户：`https://zrg.zrbyhelp.com/`
- MinIO：`https://minio.zrbyhelp.com`

如果本机端口冲突，可修改 `.env` 中的 `APP_PORT`、`MYSQL_PORT`、`MINIO_API_PORT`、`MINIO_CONSOLE_PORT`。

如果 Docker Hub 拉取不稳定，可在 `.env` 中把 `NODE_IMAGE`、`MYSQL_IMAGE`、`MINIO_IMAGE`、`MINIO_MC_IMAGE` 改成你当前可访问的镜像源地址。

## 页面

- `/login`: 统一登录入口，也支持外部服务带 `client_id/callback/state` 发起授权。
- `/feedback`: 投诉建议收集页，三方网站也可弹窗打开。
- `/relogin`: 外部服务要求用户重新登录时使用。
- `/onboarding`: 用户填写邀请码或为指定网站提交访问申请。
- `/pending`: 申请等待审核页。
- `/apps`: 全部启用网站服务列表，会标注用户是否可访问。
- `/admin`: 管理后台，服务端通过本地 session 和 `NUXT_ADMIN_ACCOUNTS` 鉴权。
- `/docs/`: VitePress 构建后的三方接入文档。生成静态文档：`pnpm docs:build`。


## 外部网站接入

完整接入说明见 [docs/service-auth.md](docs/service-auth.md)。
