# 投诉建议弹窗

三方网站可以直接打开门户的统一反馈页面，不需要接入额外 SDK。

## 弹窗打开方式

```ts
window.open(
  "https://zrg.zrbyhelp.com/feedback?service_slug=docs&embed=1&source_url=" +
    encodeURIComponent(window.location.href),
  "zr-feedback",
  "width=680,height=720"
);
```

推荐参数：

- `service_slug`: 后台创建网站服务时填写的 Slug，用于后台归类。
- `user_id`: 可选，三方系统已持有门户用户 ID 时传入。
- `source_url`: 可选，当前页面地址。
- `embed=1`: 使用更适合弹窗的页面布局。

## 后台处理

管理员在 `/admin` 的“投诉建议”标签页查看反馈，可标记为“处理中”或“已处理”。
