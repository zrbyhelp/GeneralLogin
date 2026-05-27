import { createError } from "h3";
import { requireAdminUser } from "~/server/utils/auth";
import { tryNormalizeUrl } from "~/server/utils/crypto";
import { prisma } from "~/server/utils/prisma";
import { writeAuditLog } from "~/server/utils/audit";

function cleanCallbackUrls(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateAbsoluteUrl(value: string, label: string) {
  if (!tryNormalizeUrl(value)) {
    throw createError({ statusCode: 400, statusMessage: `${label}格式无效` });
  }
}

function cleanTags(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event);
  const id = getRouterParam(event, "id");
  const body = await readBody<{
    name?: string;
    slug?: string;
    description?: string;
    displayTitle?: string;
    shortIntro?: string;
    coverImageUrl?: string;
    videoUrl?: string;
    mediaType?: string;
    tags?: string[];
    showcaseOrder?: number;
    featured?: boolean;
    homeUrl?: string;
    healthCheckUrl?: string;
    docsUrl?: string;
    callbackUrls?: string[];
    enabled?: boolean;
    allowDirectAccess?: boolean;
    allowInviteAccess?: boolean;
    allowAccessRequest?: boolean;
  }>(event);

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "缺少服务 ID" });
  }

  const callbackUrls = cleanCallbackUrls(body.callbackUrls);
  const homeUrl = body.homeUrl?.trim();
  const healthCheckUrl = typeof body.healthCheckUrl === "string"
    ? body.healthCheckUrl.trim()
    : undefined;
  const docsUrl = typeof body.docsUrl === "string" ? body.docsUrl.trim() : undefined;
  const coverImageUrl = typeof body.coverImageUrl === "string" ? body.coverImageUrl.trim() : undefined;
  const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : undefined;
  const tags = cleanTags(body.tags);
  if (homeUrl) {
    validateAbsoluteUrl(homeUrl, "入口地址");
  }
  if (healthCheckUrl) {
    validateAbsoluteUrl(healthCheckUrl, "健康检查地址");
  }
  if (docsUrl) {
    validateAbsoluteUrl(docsUrl, "文档地址");
  }
  if (coverImageUrl) {
    validateAbsoluteUrl(coverImageUrl, "封面图地址");
  }
  if (videoUrl) {
    validateAbsoluteUrl(videoUrl, "视频地址");
  }
  if (callbackUrls) {
    if (!callbackUrls.length) {
      throw createError({ statusCode: 400, statusMessage: "回调地址不能为空" });
    }
    callbackUrls.forEach((url) => validateAbsoluteUrl(url, "回调地址"));
  }

  const service = await prisma.serviceApp.update({
    where: { id },
    data: {
      name: body.name?.trim() || undefined,
      slug: body.slug?.trim().toLowerCase() || undefined,
      description:
        typeof body.description === "string" ? body.description.trim() : undefined,
      displayTitle:
        typeof body.displayTitle === "string" ? body.displayTitle.trim() || null : undefined,
      shortIntro:
        typeof body.shortIntro === "string" ? body.shortIntro.trim() || null : undefined,
      coverImageUrl:
        typeof coverImageUrl === "string" ? coverImageUrl || null : undefined,
      videoUrl: typeof videoUrl === "string" ? videoUrl || null : undefined,
      mediaType:
        typeof body.mediaType === "string"
          ? body.mediaType === "video"
            ? "video"
            : "image"
          : undefined,
      tags,
      showcaseOrder:
        typeof body.showcaseOrder === "number" && Number.isFinite(body.showcaseOrder)
          ? body.showcaseOrder
          : undefined,
      featured: typeof body.featured === "boolean" ? body.featured : undefined,
      homeUrl: homeUrl || undefined,
      healthCheckUrl:
        typeof healthCheckUrl === "string" ? healthCheckUrl || null : undefined,
      docsUrl: typeof docsUrl === "string" ? docsUrl || null : undefined,
      callbackUrls,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      allowDirectAccess:
        typeof body.allowDirectAccess === "boolean"
          ? body.allowDirectAccess
          : undefined,
      allowInviteAccess:
        typeof body.allowInviteAccess === "boolean"
          ? body.allowInviteAccess
          : undefined,
      allowAccessRequest:
        typeof body.allowAccessRequest === "boolean"
          ? body.allowAccessRequest
          : undefined
    }
  });

  await writeAuditLog({
    actorId: admin.profile.id,
    action: "admin.service.updated",
    targetType: "ServiceApp",
    targetId: service.id,
    metadata: {
      enabled: service.enabled,
      allowDirectAccess: service.allowDirectAccess,
      allowInviteAccess: service.allowInviteAccess,
      allowAccessRequest: service.allowAccessRequest
    }
  });

  return { service };
});
