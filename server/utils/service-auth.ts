import { AccessRequestStatus, UserStatus, type ServiceApp, type UserProfile } from "@prisma/client";
import { createError } from "h3";
import { generateToken, normalizeUrl, sameUrlWithoutSearch, sha256 } from "~/server/utils/crypto";
import { prisma } from "~/server/utils/prisma";
import { writeAuditLog } from "~/server/utils/audit";

export function parseCallbackUrls(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function ensureAllowedCallback(service: ServiceApp, callbackUrl: string) {
  const allowed = parseCallbackUrls(service.callbackUrls);
  if (!allowed.length) {
    throw createError({ statusCode: 400, statusMessage: "服务未配置回调地址" });
  }

  const target = normalizeUrl(callbackUrl);
  const matched = allowed.some((allowedUrl) => {
    try {
      return sameUrlWithoutSearch(allowedUrl, target.toString());
    } catch {
      return false;
    }
  });

  if (!matched) {
    throw createError({ statusCode: 400, statusMessage: "回调地址未被允许" });
  }
}

export async function canUseService(profile: UserProfile, service: ServiceApp) {
  if (profile.status === UserStatus.SUSPENDED) {
    throw createError({ statusCode: 403, statusMessage: "账号已停用" });
  }

  if (profile.isAdminSnapshot) {
    return true;
  }

  if (profile.status !== UserStatus.APPROVED) {
    throw createError({ statusCode: 403, statusMessage: "账号未审核" });
  }

  const access = await prisma.userServiceAccess.findUnique({
    where: {
      userId_serviceId: {
        userId: profile.id,
        serviceId: service.id
      }
    }
  });

  if (!access || !access.allowed) {
    throw createError({ statusCode: 403, statusMessage: "未授予此服务权限" });
  }

  return true;
}

export async function createServiceAuthCode(params: {
  profile: UserProfile;
  service: ServiceApp;
  callbackUrl: string;
  state?: string | null;
}) {
  const rawCode = generateToken(32);
  const authCode = await prisma.serviceAuthCode.create({
    data: {
      codeHash: sha256(rawCode),
      userId: params.profile.id,
      serviceId: params.service.id,
      callbackUrl: params.callbackUrl,
      state: params.state ?? null,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    }
  });

  await writeAuditLog({
    actorId: params.profile.id,
    action: "service.auth_code.created",
    targetType: "ServiceApp",
    targetId: params.service.id,
    metadata: {
      authCodeId: authCode.id
    }
  });

  return { authCode, rawCode };
}

export async function consumeServiceAuthCode(params: {
  clientId: string;
  clientSecret: string;
  code: string;
}) {
  const service = await prisma.serviceApp.findUnique({
    where: { clientId: params.clientId }
  });

  if (!service || !service.enabled) {
    throw createError({ statusCode: 401, statusMessage: "服务不可用" });
  }

  if (service.clientSecretHash !== sha256(params.clientSecret)) {
    throw createError({ statusCode: 401, statusMessage: "服务密钥错误" });
  }

  const authCode = await prisma.serviceAuthCode.findUnique({
    where: { codeHash: sha256(params.code) },
    include: {
      user: true,
      service: true
    }
  });

  if (!authCode || authCode.serviceId !== service.id) {
    throw createError({ statusCode: 404, statusMessage: "授权码无效" });
  }

  if (authCode.consumedAt) {
    throw createError({ statusCode: 409, statusMessage: "授权码已使用" });
  }

  if (authCode.expiresAt.getTime() < Date.now()) {
    throw createError({ statusCode: 410, statusMessage: "授权码已过期" });
  }

  const user = await prisma.userProfile.findUnique({
    where: { id: authCode.userId }
  });

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "用户不存在" });
  }

  await canUseService(user, service);

  await prisma.serviceAuthCode.updateMany({
    where: {
      id: authCode.id,
      consumedAt: null
    },
    data: {
      consumedAt: new Date()
    }
  });

  return {
    service,
    user,
    callbackUrl: authCode.callbackUrl,
    state: authCode.state
  };
}

export async function createOrReuseAccessRequest(params: {
  profile: UserProfile;
  service: ServiceApp;
  message?: string | null;
}) {
  const existing = await prisma.accessRequest.findFirst({
    where: {
      requesterId: params.profile.id,
      serviceId: params.service.id,
      status: AccessRequestStatus.PENDING
    },
    orderBy: { createdAt: "desc" }
  });

  if (existing) {
    return existing;
  }

  return prisma.accessRequest.create({
    data: {
      requesterId: params.profile.id,
      serviceId: params.service.id,
      message: params.message?.trim() || "用户通过统一登录门户发起访问申请。"
    }
  });
}
