import { createError } from "h3";
import { requirePortalUser } from "~/server/utils/auth";
import { normalizeUrl } from "~/server/utils/crypto";
import { prisma } from "~/server/utils/prisma";
import {
  canUseService,
  createOrReuseAccessRequest,
  createServiceAuthCode,
  ensureAllowedCallback,
  parseCallbackUrls
} from "~/server/utils/service-auth";

export default defineEventHandler(async (event) => {
  const { profile } = await requirePortalUser(event);
  const body = await readBody<{
    clientId?: string;
    serviceId?: string;
    serviceSlug?: string;
    callbackUrl?: string;
    state?: string;
    theme?: string;
    locale?: string;
  }>(event);

  const service = await prisma.serviceApp.findFirst({
    where: {
      enabled: true,
      OR: [
        body.serviceId ? { id: body.serviceId } : undefined,
        body.clientId ? { clientId: body.clientId } : undefined,
        body.serviceSlug ? { slug: body.serviceSlug } : undefined
      ].filter(Boolean) as never
    }
  });

  if (!service) {
    throw createError({ statusCode: 404, statusMessage: "服务不存在或未启用" });
  }

  const fallbackCallback = parseCallbackUrls(service.callbackUrls)[0];
  const callbackUrl = body.callbackUrl?.trim() || fallbackCallback;

  if (!callbackUrl) {
    throw createError({ statusCode: 400, statusMessage: "缺少回调地址" });
  }

  ensureAllowedCallback(service, callbackUrl);

  const theme = body.theme === "dark" || body.theme === "light" ? body.theme : "";
  const locale = body.locale === "en" || body.locale === "zh" ? body.locale : "";

  if (profile.status === "SUSPENDED") {
    throw createError({ statusCode: 403, statusMessage: "账号已停用" });
  }

  try {
    await canUseService(profile, service);
  } catch (error) {
    const params = new URLSearchParams({
      client_id: service.clientId,
      service_id: service.id,
      callback: callbackUrl
    });
    if (body.state) {
      params.set("state", body.state);
    }
    if (theme) {
      params.set("theme", theme);
    }
    if (locale) {
      params.set("locale", locale);
    }

    if (service.allowInviteAccess) {
      return {
        status: "needs_onboarding",
        redirectUrl: `/onboarding?${params}`
      };
    }

    if (!service.allowAccessRequest) {
      throw createError({ statusCode: 403, statusMessage: "此服务未开放访问申请" });
    }

    const request = await createOrReuseAccessRequest({ profile, service });
    const pendingParams = new URLSearchParams({
      service: service.slug
    });
    if (theme) {
      pendingParams.set("theme", theme);
    }
    if (locale) {
      pendingParams.set("locale", locale);
    }
    return {
      status: "needs_access",
      requestId: request.id,
      redirectUrl: `/pending?${pendingParams}`
    };
  }

  const { rawCode } = await createServiceAuthCode({
    profile,
    service,
    callbackUrl,
    state: body.state
  });

  const redirect = normalizeUrl(callbackUrl);
  redirect.searchParams.set("code", rawCode);
  if (body.state) {
    redirect.searchParams.set("state", body.state);
  }
  if (theme) {
    redirect.searchParams.set("theme", theme);
  }
  if (locale) {
    redirect.searchParams.set("locale", locale);
  }

  return {
    status: "authorized",
    redirectUrl: redirect.toString(),
    expiresIn: 300
  };
});
