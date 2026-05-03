import { UserStatus } from "@prisma/client";
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

  if (profile.status === UserStatus.SUSPENDED) {
    throw createError({ statusCode: 403, statusMessage: "账号已停用" });
  }

  if (profile.status !== UserStatus.APPROVED && !profile.isAdminSnapshot) {
    return {
      status: "needs_onboarding",
      redirectUrl: `/onboarding?client_id=${encodeURIComponent(service.clientId)}&callback=${encodeURIComponent(callbackUrl)}`
    };
  }

  try {
    await canUseService(profile, service);
  } catch (error) {
    const request = await createOrReuseAccessRequest({ profile, service });
    return {
      status: "needs_access",
      requestId: request.id,
      redirectUrl: `/pending?service=${encodeURIComponent(service.slug)}`
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

  return {
    status: "authorized",
    redirectUrl: redirect.toString(),
    expiresIn: 300
  };
});
