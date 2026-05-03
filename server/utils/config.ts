export function getRuntimeConfig() {
  return useRuntimeConfig();
}

export function getAdminEmails() {
  const config = getRuntimeConfig();
  const raw = config.adminEmails || "";
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getAdminAccounts() {
  const config = getRuntimeConfig();
  const raw = String(config.adminAccounts || "");
  return raw
    .split(",")
    .map((account: string) => account.trim().toLowerCase())
    .filter(Boolean);
}

export function getAppUrl() {
  const config = getRuntimeConfig();
  return config.public.appUrl || "http://localhost:3000";
}

export function getDefaultCallbackUrl() {
  const config = getRuntimeConfig();
  return config.public.defaultCallbackUrl || "";
}

export function getMinioConfig() {
  const config = getRuntimeConfig();
  return {
    endpoint: config.minioEndpoint || "",
    port: Number(config.minioPort || 0) || undefined,
    useSSL: String(config.minioUseSSL || "false") === "true",
    accessKey: config.minioAccessKey || "",
    secretKey: config.minioSecretKey || "",
    bucket: config.minioBucket || "",
    region: config.minioRegion || "us-east-1",
    publicBaseUrl: config.minioPublicBaseUrl || ""
  };
}

export function getLinuxdoConfig() {
  const config = getRuntimeConfig();
  const appUrl = getAppUrl();

  return {
    clientId: config.linuxdoClientId || "",
    clientSecret: config.linuxdoClientSecret || "",
    redirectUri:
      config.linuxdoRedirectUri ||
      `${appUrl.replace(/\/$/, "")}/api/auth/linuxdo/callback`,
    authorizeUrl:
      config.linuxdoAuthorizeUrl ||
      "https://connect.linux.do/oauth2/authorize",
    tokenUrl:
      config.linuxdoTokenUrl ||
      "https://connect.linux.do/oauth2/token",
    userUrl: config.linuxdoUserUrl || "https://connect.linux.do/api/user",
    scope: config.linuxdoScope || ""
  };
}
