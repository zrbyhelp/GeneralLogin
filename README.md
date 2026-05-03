# ZR-AI服务

Nuxt 统一登录门户，内置邮箱密码注册登录和 Linux.do 第三方登录，MySQL + Prisma 保存用户准入、邀请码、网站服务和授权记录，后台 UI 使用 Element Plus。

## 快速启动

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
- `NUXT_ADMIN_EMAILS`: 管理员邮箱，多个用英文逗号分隔
- `NUXT_PUBLIC_APP_URL`: 门户公网地址
- `NUXT_LINUXDO_CLIENT_ID`: Linux.do Connect 应用 Client ID
- `NUXT_LINUXDO_CLIENT_SECRET`: Linux.do Connect 应用 Client Secret
- `NUXT_LINUXDO_REDIRECT_URI`: Linux.do 回调地址，通常为 `https://login.example.com/api/auth/linuxdo/callback`
- `NUXT_LINUXDO_SCOPE`: 可选，Linux.do Connect 应用需要 scope 时再填写
- `NUXT_LINUXDO_AUTHORIZE_URL` / `NUXT_LINUXDO_TOKEN_URL` / `NUXT_LINUXDO_USER_URL`: 可选，覆盖 Linux.do OAuth 端点

3. 启动本地 MySQL：

```bash
docker compose up -d mysql
```

4. 初始化数据库：

```bash
pnpm db:push
```

5. 启动开发服务：

```bash
pnpm dev
```

## 页面

- `/login`: 统一登录入口，也支持外部服务带 `client_id/callback/state` 发起授权。
- `/relogin`: 外部服务要求用户重新登录时使用。
- `/onboarding`: 新用户填写邀请码或申请信息。
- `/pending`: 申请等待审核页。
- `/apps`: 用户可访问的网站服务列表。
- `/admin`: 管理后台，服务端通过本地 session 和 `NUXT_ADMIN_EMAILS` 鉴权。

## 外部网站接入

完整接入说明见 [docs/service-auth.md](docs/service-auth.md)。
