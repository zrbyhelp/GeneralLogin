import { createError } from "h3";
import { requireAdminUser } from "~/server/utils/auth";
import { prisma } from "~/server/utils/prisma";
import { writeAuditLog } from "~/server/utils/audit";

function normalizeSortOrder(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

async function ensureServiceExists(serviceId: string) {
  const service = await prisma.serviceApp.findUnique({
    where: { id: serviceId },
    select: { id: true }
  });

  if (!service) {
    throw createError({ statusCode: 400, statusMessage: "选择的网站不存在" });
  }
}

export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event);
  const body = await readBody<{
    title?: string;
    content?: string;
    serviceId?: string | null;
    sortOrder?: number;
    enabled?: boolean;
  }>(event);

  const title = body.title?.trim();
  const content = body.content?.trim();
  const serviceId = typeof body.serviceId === "string" ? body.serviceId.trim() : "";

  if (!title || !content) {
    throw createError({ statusCode: 400, statusMessage: "公告标题和内容为必填" });
  }

  if (serviceId) {
    await ensureServiceExists(serviceId);
  }

  const announcement = await prisma.announcement.create({
    data: {
      title,
      content,
      serviceId: serviceId || null,
      sortOrder: normalizeSortOrder(body.sortOrder),
      enabled: body.enabled !== false
    }
  });

  await writeAuditLog({
    actorId: admin.profile.id,
    action: "admin.announcement.created",
    targetType: "Announcement",
    targetId: announcement.id,
    metadata: {
      title,
      serviceId: announcement.serviceId
    }
  });

  return { announcement };
});
