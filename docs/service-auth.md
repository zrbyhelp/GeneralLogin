# 外部网站服务鉴权接入说明

门户提供“统一登录 + 一次性授权码”的接入方式。外部网站不读取门户 session，只在自己的服务端用 `clientId + clientSecret + code` 换取用户身份，然后建立自己的站点 session。

## 1. 管理员创建网站服务

进入 `/admin` 的“网站服务”创建服务：

- 服务名称、Slug、入口地址。
- 允许的回调地址：每行一个，例如 `https://app.example.com/auth/callback`。
- 访问开关：允许直接访问、允许邀请码、允许申请审核。

创建后后台会显示：

- `clientId`: 可用于拼接门户登录 URL。
- `clientSecret`: 只显示一次，只能保存在外部网站服务端。

如果网站未开启“直接访问”，用户必须通过绑定该网站的邀请码，或通过该网站的申请审核后才能进入。

## 2. 外部服务发起登录

用户访问外部网站但没有本地 session 时，把浏览器跳转到门户：

```text
https://login.example.com/login?client_id=svc_xxx&callback=https%3A%2F%2Fapp.example.com%2Fauth%2Fcallback&state=random_state
```

参数：

- `client_id`: 后台创建服务时得到的 `clientId`。
- `callback`: 外部服务回调地址，必须匹配后台配置的允许回调地址。
- `state`: 外部服务生成的随机字符串，用于防 CSRF 和恢复登录前状态。
- `theme`: 可选，`light` 或 `dark`，门户回跳第三方时会原样携带。
- `locale`: 可选，`zh` 或 `en`，门户回跳第三方时会原样携带。

门户会校验用户是否停用、服务是否启用、回调地址是否允许，以及用户是否可访问该服务。通过后回跳：

```text
https://app.example.com/auth/callback?code=one_time_code&state=random_state&theme=dark&locale=zh
```

`code` 有效期 5 分钟，只能使用一次。

## 3. 外部服务端换取用户身份

外部网站 callback 路由收到 `code` 后，必须在服务端请求门户：

```http
POST https://login.example.com/api/service-auth/token
Content-Type: application/json

{
  "clientId": "svc_xxx",
  "clientSecret": "sk_xxx",
  "code": "one_time_code"
}
```

成功响应：

```json
{
  "ok": true,
  "user": {
    "id": "user_profile_id",
    "account": "portal_account",
    "email": "user@example.com",
    "username": "username",
    "name": "User Name",
    "avatarUrl": "https://...",
    "status": "ACTIVE"
  },
  "service": {
    "id": "service_id",
    "slug": "docs",
    "name": "Docs"
  },
  "state": "random_state",
  "reloginUrl": "https://login.example.com/relogin?client_id=svc_xxx&callback=..."
}
```

外部服务应在自己的系统中创建 session，不要把 `clientSecret` 暴露给前端。

## 4. 轮询用户启用状态

第三方服务可以轮询用户是否仍启用：

```http
POST https://login.example.com/api/service-auth/user-status
Content-Type: application/json

{
  "clientId": "svc_xxx",
  "clientSecret": "sk_xxx",
  "userId": "user_profile_id"
}
```

响应：

```json
{
  "ok": true,
  "userId": "user_profile_id",
  "enabled": true,
  "status": "ACTIVE",
  "serviceAccess": true
}
```

当 `enabled` 为 `false` 或 `serviceAccess` 为 `false` 时，外部服务应结束本地 session 或拒绝继续访问。

## 5. 修改用户资料和上传头像

第三方服务可以在自己的服务端调用门户接口，修改当前服务可访问用户的资料。该接口也支持修改密码，但已有密码用户必须提供当前密码。

```http
PATCH https://login.example.com/api/service-auth/user-profile
Content-Type: application/json

{
  "clientId": "svc_xxx",
  "clientSecret": "sk_xxx",
  "userId": "user_profile_id",
  "name": "新的显示名称",
  "avatarUrl": "https://cdn.example.com/avatar.png",
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

`username` 是第三方账号同步字段，不作为门户账号密码登录名，也不开放修改。门户自有登录账号 `account` 同样不通过该接口修改。

如需直接上传头像，使用 multipart 表单。文件会写入 MinIO，并把返回 URL 保存到用户头像。

```http
POST https://login.example.com/api/service-auth/user-avatar
Content-Type: multipart/form-data

clientId=svc_xxx
clientSecret=sk_xxx
userId=user_profile_id
file=@avatar.png
```

## 6. 第三方文件上传

接入网站不要直接使用 MinIO 凭据。服务端用 `clientId + clientSecret` 调用统一上传接口，文件会存到 `services/{serviceId}/...` 路径下，单文件最大 10MB。

```http
POST https://login.example.com/api/service-auth/files
Content-Type: multipart/form-data

clientId=svc_xxx
clientSecret=sk_xxx
userId=user_profile_id
purpose=attachments
file=@report.pdf
```

`userId` 可选；传入时门户会校验该用户仍可访问当前服务。成功响应包含 `file.url`、`file.objectName`、`file.size` 和 `file.contentType`。`NUXT_MINIO_PUBLIC_BASE_URL` 应配置为外部可访问地址。

## 7. 邀请码与申请

邀请码由管理员创建，可以同时绑定多个网站。用户使用后会一次获得这些网站的权限，但只对仍启用且开放邀请码的网站生效。

申请审核按单个网站处理。管理员通过申请后，只授予该网站权限，不会改变用户对其他网站的访问权限。

## 8. 重新登录

当外部服务希望用户重新登录，或本地 session 过期时，跳转到：

```text
https://login.example.com/relogin?client_id=svc_xxx&callback=https%3A%2F%2Fapp.example.com%2Fauth%2Fcallback&state=new_random_state
```

门户会先退出当前本地 session，再回到 `/login` 继续标准授权流程。

## 9. 投诉建议弹窗

三方系统可以在页面内打开门户统一反馈页：

```ts
window.open(
  "https://login.example.com/feedback?service_slug=docs&embed=1&source_url=" +
    encodeURIComponent(window.location.href),
  "zr-feedback",
  "width=680,height=720"
);
```

推荐传入 `service_slug` 和 `source_url`，便于后台按网站和来源页面处理。

## 10. Linux.do 第三方登录

在 Linux.do Connect 创建应用，并把回调地址配置为：

```text
https://login.example.com/api/auth/linuxdo/callback
```

环境变量：

```env
NUXT_LINUXDO_CLIENT_ID="..."
NUXT_LINUXDO_CLIENT_SECRET="..."
NUXT_LINUXDO_REDIRECT_URI="https://login.example.com/api/auth/linuxdo/callback"
NUXT_LINUXDO_SCOPE=""
NUXT_LINUXDO_AUTHORIZE_URL="https://connect.linux.do/oauth2/authorize"
NUXT_LINUXDO_TOKEN_URL="https://connect.linux.do/oauth2/token"
NUXT_LINUXDO_USER_URL="https://connect.linux.do/api/user"
```

管理员账号建议使用门户账号密码注册，并配置在 `NUXT_ADMIN_ACCOUNTS`。旧的 `NUXT_ADMIN_EMAILS` 仍保留兼容已有邮箱管理员。

## 11. 安全约束

- `clientSecret` 只存服务端，泄漏后需要在 `/admin` 轮换密钥。
- MinIO 的 `accessKey/secretKey` 只配置在门户服务端，不提供给第三方网站前端或后端。
- 授权码只保存 hash，明文 code 只通过浏览器回跳一次。
- 外部服务必须校验 `state`。
- 回调地址必须由管理员预先配置。
- 用户被停用、服务被关闭或服务权限被取消时，门户不会发放或兑换授权码。
