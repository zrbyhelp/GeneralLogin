import { createError } from "h3";
import { requireAdminUser } from "~/server/utils/auth";
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

export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event);
  const id = getRouterParam(event, "id");
  const body = await readBody<{
    name?: string;
    slug?: string;
    description?: string;
    homeUrl?: string;
    callbackUrls?: string[];
    enabled?: boolean;
  }>(event);

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "缺少服务 ID" });
  }

  const callbackUrls = cleanCallbackUrls(body.callbackUrls);
  const service = await prisma.serviceApp.update({
    where: { id },
    data: {
      name: body.name?.trim() || undefined,
      slug: body.slug?.trim().toLowerCase() || undefined,
      description:
        typeof body.description === "string" ? body.description.trim() : undefined,
      homeUrl: body.homeUrl?.trim() || undefined,
      callbackUrls,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined
    }
  });

  await writeAuditLog({
    actorId: admin.profile.id,
    action: "admin.service.updated",
    targetType: "ServiceApp",
    targetId: service.id,
    metadata: { enabled: service.enabled }
  });

  return { service };
});
