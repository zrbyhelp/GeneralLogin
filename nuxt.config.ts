export default defineNuxtConfig({
  compatibilityDate: "2025-01-15",
  devtools: { enabled: true },
  modules: ["@element-plus/nuxt"],
  css: ["~/assets/css/main.css"],
  runtimeConfig: {
    adminEmails: "",
    linuxdoClientId: "",
    linuxdoClientSecret: "",
    linuxdoRedirectUri: "",
    linuxdoAuthorizeUrl: "https://connect.linux.do/oauth2/authorize",
    linuxdoTokenUrl: "https://connect.linux.do/oauth2/token",
    linuxdoUserUrl: "https://connect.linux.do/api/user",
    linuxdoScope: "",
    public: {
      appName: "ZR-AI服务",
      appUrl: "http://localhost:3000",
      defaultCallbackUrl: ""
    }
  },
  app: {
    head: {
      htmlAttrs: { lang: "zh-CN" },
      title: "ZR-AI服务",
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content: "统一登录门户、邀请码审核和网站服务授权中心"
        }
      ]
    }
  },
  nitro: {
    experimental: {
      openAPI: true
    }
  },
  vite: {
    server: {
      allowedHosts: ["yevette-overcopious-darrick.ngrok-free.dev"]
    }
  }
});
