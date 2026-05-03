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

    if (user.status !== UserStatus.APPROVED && !user.isAdminSnapshot) {
      const params = new URLSearchParams({
        client_id: service.clientId,
        callback: callbackUrl
      });
      if (parsed.state) {
        params.set("state", parsed.state);
      }
      return sendRedirect(event, `/onboarding?${params}`, 302);
    }

    try {
      await canUseService(user, service);
    } catch {
      await createOrReuseAccessRequest({ profile: user, service });
      return sendRedirect(
        event,
        `/pending?service=${encodeURIComponent(service.slug)}`,
        302
      );
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
    return sendRedirect(event, redirect.toString(), 302);
  }

  return sendRedirect(event, "/apps", 302);
});
