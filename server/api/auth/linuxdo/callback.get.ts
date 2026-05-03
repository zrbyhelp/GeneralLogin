import { createError, deleteCookie, getCookie, getQuery, sendRedirect } from "h3";
import {
  exchangeLinuxdoCode,
  findOrCreateLinuxdoUser,
  ensureUserCanLogin,
  parseExternalLoginState
} from "~/server/utils/auth-service";
import { createSession } from "~/server/utils/auth";
import {
  canUseService,
  createOrReuseAccessRequest,
  createServiceAuthCode,
  ensureAllowedCallback
} from "~/server/utils/service-auth";
import { prisma } from "~/server/utils/prisma";
import { UserStatus } from "@prisma/client";

const OAUTH_COOKIE = "zr_linuxdo_state";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = typeof query.code === "string" ? query.code : "";
  const state = typeof query.state === "string" ? query.state : "";

  if (!code || !state) {
    throw createError({ statusCode: 400, message: "缺少授权参数" });
  }

  const stored = getCookie(event, OAUTH_COOKIE);
  deleteCookie(event, OAUTH_COOKIE, { path: "/" });

  if (!stored) {
    throw createError({ statusCode: 400, message: "授权状态已失效" });
  }

  const parsed = parseExternalLoginState(stored);
  if (!parsed.oauthState || parsed.oauthState !== state) {
    throw createError({ statusCode: 400, message: "授权状态不匹配" });
  }

  const { id, username, name, avatarUrl, profile } = await exchangeLinuxdoCode(code);
  const user = await findOrCreateLinuxdoUser({
    linuxdoUserId: id,
    username: username || undefined,
    name: name || undefined,
    avatarUrl: avatarUrl || undefined,
    profile
  });

  await ensureUserCanLogin(user);
  await createSession(event, user);

  const clientId = parsed.clientId || "";
  const callbackUrl = parsed.callbackUrl || "";
  const theme = parsed.theme === "dark" || parsed.theme === "light" ? parsed.theme : "";
  const locale = parsed.locale === "en" || parsed.locale === "zh" ? parsed.locale : "";
  if (clientId && callbackUrl) {
    const service = await prisma.serviceApp.findFirst({
      where: {
        enabled: true,
        clientId
      }
    });

    if (!service) {
      throw createError({ statusCode: 404, message: "服务不存在或未启用" });
    }

    ensureAllowedCallback(service, callbackUrl);

    if (user.status === UserStatus.SUSPENDED) {
      throw createError({ statusCode: 403, message: "账号已停用" });
    }

    try {
      await canUseService(user, service);
    } catch {
      const params = new URLSearchParams({
        client_id: service.clientId,
        service_id: service.id,
        callback: callbackUrl
      });
      if (parsed.state) {
        params.set("state", parsed.state);
      }
      if (theme) {
        params.set("theme", theme);
      }
      if (locale) {
        params.set("locale", locale);
      }

      if (service.allowInviteAccess) {
        return sendRedirect(event, `/onboarding?${params}`, 302);
      }

      if (!service.allowAccessRequest) {
        throw createError({ statusCode: 403, message: "此服务未开放访问申请" });
      }

      await createOrReuseAccessRequest({ profile: user, service });
      const pendingParams = new URLSearchParams({
        service: service.slug
      });
      if (theme) {
        pendingParams.set("theme", theme);
      }
      if (locale) {
        pendingParams.set("locale", locale);
      }
      return sendRedirect(event, `/pending?${pendingParams}`, 302);
    }

    const { rawCode } = await createServiceAuthCode({
      profile: user,
      service,
      callbackUrl,
      state: parsed.state || undefined
    });

    const redirect = new URL(callbackUrl);
    redirect.searchParams.set("code", rawCode);
    if (parsed.state) {
      redirect.searchParams.set("state", parsed.state);
    }
    if (theme) {
      redirect.searchParams.set("theme", theme);
    }
    if (locale) {
      redirect.searchParams.set("locale", locale);
    }
    return sendRedirect(event, redirect.toString(), 302);
  }

  return sendRedirect(event, "/apps", 302);
});
