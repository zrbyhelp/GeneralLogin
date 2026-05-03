import { createError } from "h3";
import { requireAdminUser } from "~/server/utils/auth";
import { generateToken, sha256 } from "~/server/utils/crypto";
import { prisma } from "~/server/utils/prisma";
import { writeAuditLog } from "~/server/utils/audit";

function cleanCallbackUrls(value: unknown) {
  const urls = Array.isArray(value) ? value : [];
  return urls
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event);
  const body = await readBody<{
    name?: string;
    slug?: string;
    description?: string;
    homeUrl?: string;
    callbackUrls?: string[];
  }>(event);

  const name = body.name?.trim();
  const slug = body.slug?.trim().toLowerCase();
  const homeUrl = body.homeUrl?.trim();
  const callbackUrls = cleanCallbackUrls(body.callbackUrls);

  if (!name || !slug || !homeUrl || !callbackUrls.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "服务名称、slug、入口地址、回调地址均为必填"
    });
  }

  const clientId = `svc_${generateToken(12)}`;
  const clientSecret = `sk_${generateToken(32)}`;
  const service = await prisma.serviceApp.create({
    data: {
      name,
      slug,
      description: body.description?.trim() || null,
      homeUrl,
      callbackUrls,
      clientId,
      clientSecretHash: sha256(clientSecret)
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
      homeUrl: service.homeUrl,
      callbackUrls,
      clientId: service.clientId,
      enabled: service.enabled
    },
    clientSecret
  };
});
