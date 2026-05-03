# 外部网站服务鉴权接入说明

门户提供“统一登录 + 一次性授权码”的接入方式。外部网站不直接读取门户 session，只在自己的服务端用 `clientId + clientSecret + code` 换取用户身份，然后建立自己的站点 session。

## 1. 管理员创建网站服务

进入 `/admin`，在“网站服务”中创建服务：

- 服务名称：展示给用户看的名称。
- Slug：服务短标识。
- 入口地址：服务首页，例如 `https://app.example.com`。
- 允许的回调地址：例如 `https://app.example.com/auth/callback`，每行一个。

创建后后台会显示：

- `clientId`: 可以放在服务端配置中，也可以用于拼登录 URL。
- `clientSecret`: 只显示一次，只能保存在外部网站服务端，不能放到浏览器。

后台所有 `/api/admin/**` 接口都会调用服务端管理员鉴权：必须已通过邮箱密码或 Linux.do 登录，并且账号邮箱在 `NUXT_ADMIN_EMAILS` 中。

## 2. 外部服务发起登录

用户访问外部网站但没有本地 session 时，把浏览器跳转到门户：

```text
https://login.example.com/login?client_id=svc_xxx&callback=https%3A%2F%2Fapp.example.com%2Fauth%2Fcallback&state=random_state
```

参数：

- `client_id`: 后台创建服务时得到的 `clientId`。
- `callback`: 外部服务的回调地址，必须匹配后台配置的允许回调地址。校验使用 origin + pathname，query 会被保留。
- `state`: 外部服务生成的随机字符串，用来防 CSRF 和恢复登录前状态。

门户会完成以下校验：

- 用户是否已通过门户登录。
- 用户是否已通过准入审核。
- 用户是否拥有该服务访问权限。
- `callback` 是否在该服务允许列表中。

通过后门户会跳回：

```text
https://app.example.com/auth/callback?code=one_time_code&state=random_state
```

`code` 有效期 5 分钟，只能使用一次。

## 3. 外部服务端换取用户身份

外部网站的 callback 路由收到 `code` 后，必须在服务端请求门户：

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
    "email": "user@example.com",
    "username": "username",
    "name": "User Name",
    "avatarUrl": "https://...",
    "status": "APPROVED"
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

外部服务应在自己的系统中创建 session，不要把 `clientSecret` 或门户返回的敏感信息暴露给前端。

## 4. Node/Express 示例

```js
import express from "express";

const app = express();
const portalUrl = process.env.PORTAL_URL;
const clientId = process.env.PORTAL_CLIENT_ID;
const clientSecret = process.env.PORTAL_CLIENT_SECRET;
const callback = "https://app.example.com/auth/callback";

app.get("/login", (req, res) => {
  const state = crypto.randomUUID();
  req.session.authState = state;

  const login = new URL("/login", portalUrl);
  login.searchParams.set("client_id", clientId);
  login.searchParams.set("callback", callback);
  login.searchParams.set("state", state);

  res.redirect(login.toString());
});

app.get("/auth/callback", async (req, res, next) => {
  try {
    if (req.query.state !== req.session.authState) {
      res.status(400).send("invalid state");
      return;
    }

    const response = await fetch(new URL("/api/service-auth/token", portalUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId,
        clientSecret,
        code: req.query.code
      })
    });

    if (!response.ok) {
      res.status(401).send("portal auth failed");
      return;
    }

    const payload = await response.json();
    req.session.user = payload.user;
    req.session.reloginUrl = payload.reloginUrl;
    res.redirect("/");
  } catch (error) {
    next(error);
  }
});
```

## 5. 重新登录

当外部服务希望用户重新登录，或本地 session 过期时，跳转到：

```text
https://login.example.com/relogin?client_id=svc_xxx&callback=https%3A%2F%2Fapp.example.com%2Fauth%2Fcallback&state=new_random_state
```

门户会先退出当前本地 session，再回到 `/login` 继续标准授权流程。

## 7. Linux.do 第三方登录

在 Linux.do Connect 创建应用，并把回调地址配置为：

```text
https://login.example.com/api/auth/linuxdo/callback
```

然后配置：

```env
NUXT_LINUXDO_CLIENT_ID="..."
NUXT_LINUXDO_CLIENT_SECRET="..."
NUXT_LINUXDO_REDIRECT_URI="https://login.example.com/api/auth/linuxdo/callback"
# 可选，需要 scope 时再填写
NUXT_LINUXDO_SCOPE=""
# 可选，自定义 Linux.do OAuth 端点
NUXT_LINUXDO_AUTHORIZE_URL="https://connect.linux.do/oauth2/authorize"
NUXT_LINUXDO_TOKEN_URL="https://connect.linux.do/oauth2/token"
NUXT_LINUXDO_USER_URL="https://connect.linux.do/api/user"
```

门户默认使用：

- 浏览器授权地址：`https://connect.linux.do/oauth2/authorize`
- 服务端换 token 地址：`https://connect.linux.do/oauth2/token`
- 服务端用户信息地址：`https://connect.linux.do/api/user`

Linux.do 用户信息通常不包含邮箱，因此这类用户默认不会命中 `NUXT_ADMIN_EMAILS` 管理员白名单；管理员账号建议使用邮箱密码注册。

## 6. 权限与安全约束

- `clientSecret` 只存服务端，泄漏后需要在 `/admin` 轮换密钥。
- 授权码只保存 hash，明文 code 只通过浏览器回跳一次。
- 授权码 5 分钟过期且只能消费一次。
- 外部服务必须校验 `state`。
- 回调地址必须先由管理员配置，未配置的地址不能回跳。
- 用户被停用、未审核或未授权服务时，门户不会发放授权码。
