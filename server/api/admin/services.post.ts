import { createError } from "h3";
import { requireAdminUser } from "~/server/utils/auth";
import { generateToken, sha256, tryNormalizeUrl } from "~/server/utils/crypto";
import { prisma } from "~/server/utils/prisma";
import { writeAuditLog } from "~/server/utils/audit";

function cleanCallbackUrls(value: unknown) {
  const urls = Array.isArray(value) ? value : [];
  return urls
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
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event);
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
    allowDirectAccess?: boolean;
    allowInviteAccess?: boolean;
    allowAccessRequest?: boolean;
  }>(event);

  const name = body.name?.trim();
  const slug = body.slug?.trim().toLowerCase();
  const homeUrl = body.homeUrl?.trim();
  const healthCheckUrl = body.healthCheckUrl?.trim() || null;
  const docsUrl = body.docsUrl?.trim() || null;
  const coverImageUrl = body.coverImageUrl?.trim() || null;
  const videoUrl = body.videoUrl?.trim() || null;
  const mediaType = body.mediaType === "video" ? "video" : "image";
  const tags = cleanTags(body.tags);
  const callbackUrls = cleanCallbackUrls(body.callbackUrls);

  if (!name || !slug || !homeUrl || !callbackUrls.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "服务名称、slug、入口地址、回调地址均为必填"
    });
  }

  validateAbsoluteUrl(homeUrl, "入口地址");
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
  callbackUrls.forEach((url) => validateAbsoluteUrl(url, "回调地址"));

  const clientId = `svc_${generateToken(12)}`;
  const clientSecret = `sk_${generateToken(32)}`;
  const service = await prisma.serviceApp.create({
    data: {
      name,
      slug,
      description: body.description?.trim() || null,
      displayTitle: body.displayTitle?.trim() || null,
      shortIntro: body.shortIntro?.trim() || null,
      coverImageUrl,
      videoUrl,
      mediaType,
      tags,
      showcaseOrder: Number.isFinite(body.showcaseOrder) ? Number(body.showcaseOrder) : 0,
      featured: Boolean(body.featured),
      homeUrl,
      healthCheckUrl,
      docsUrl,
      callbackUrls,
      clientId,
      clientSecretHash: sha256(clientSecret),
      allowDirectAccess: Boolean(body.allowDirectAccess),
      allowInviteAccess: body.allowInviteAccess !== false,
      allowAccessRequest: body.allowAccessRequest !== false
    }
  });

  await writeAuditLog({
    actorId: admin.profile.id,
    action: "admin.service.created",
    targetType: "ServiceApp",
    targetId: service.id,
    metadata: { slug }
  });

  return {
    service: {
      id: service.id,
      name: service.name,
      slug: service.slug,
      displayTitle: service.displayTitle,
      shortIntro: service.shortIntro,
      coverImageUrl: service.coverImageUrl,
      videoUrl: service.videoUrl,
      mediaType: service.mediaType,
      tags,
      showcaseOrder: service.showcaseOrder,
      featured: service.featured,
      homeUrl: service.homeUrl,
      healthCheckUrl: service.healthCheckUrl,
      docsUrl: service.docsUrl,
      callbackUrls,
      clientId: service.clientId,
      enabled: service.enabled,
      allowDirectAccess: service.allowDirectAccess,
      allowInviteAccess: service.allowInviteAccess,
      allowAccessRequest: service.allowAccessRequest
    },
    clientSecret
  };
});
