import { defineConfig } from "vitepress";

export default defineConfig({
  title: "ZR-AI服务接入文档",
  description: "统一登录门户、三方网站接入和反馈能力说明",
  base: "/docs/",
  outDir: "../public/docs",
  cleanUrls: true,
  ignoreDeadLinks: true,
  themeConfig: {
    nav: [
      { text: "首页", link: "/" },
      { text: "三方接入", link: "/service-auth" },
      { text: "投诉建议", link: "/feedback" }
    ],
    sidebar: [
      {
        text: "接入指南",
        items: [
          { text: "概览", link: "/" },
          { text: "三方鉴权", link: "/service-auth" },
          { text: "投诉建议弹窗", link: "/feedback" }
        ]
      }
    ]
  }
});
