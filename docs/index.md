# ZR-AI服务接入文档

本应用提供统一登录门户、网站级访问控制、三方授权码换取用户身份、用户状态检查、头像和文件上传、投诉建议收集等能力。

## 当前线上地址

- 门户：`https://zrg.zrbyhelp.com/`
- MinIO：`https://minio.zrbyhelp.com`

## 推荐接入流程

1. 管理员在门户后台创建网站服务，填写入口地址、回调地址、健康检查地址和文档地址。
2. 三方网站在未登录时跳转到门户 `/login`，携带 `client_id`、`callback`、`state`。
3. 门户验证用户是否有当前网站权限，通过后回调三方网站并携带一次性 `code`。
4. 三方网站服务端用 `clientId + clientSecret + code` 请求 `/api/service-auth/token` 换取用户身份。
5. 三方网站建立自己的本地 session，并定期调用 `/api/service-auth/user-status` 判断用户是否仍可访问。

## 用户体验能力

- 门户会在三方回调中携带 `theme` 和 `locale`，方便三方网站同步日夜模式和语言。
- 三方网站可打开 `/feedback?service_slug=xxx&embed=1` 收集投诉建议。
- 三方网站可调用门户的头像、资料和文件上传接口，避免直接暴露对象存储凭据。
