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
  const id = getRouterParam(event, "id");
  const body = await readBody<{
    title?: string;
    content?: string;
    serviceId?: string | null;
    sortOrder?: number;
    enabled?: boolean;
  }>(event);

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "缺少公告 ID" });
  }

  const data: {
    title?: string;
    content?: string;
    serviceId?: string | null;
    sortOrder?: number;
    enabled?: boolean;
  } = {};

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) {
      throw createError({ statusCode: 400, statusMessage: "公告标题不能为空" });
    }
    data.title = title;
  }

  if (typeof body.content === "string") {
    const content = body.content.trim();
    if (!content) {
      throw createError({ statusCode: 400, statusMessage: "公告内容不能为空" });
    }
    data.content = content;
  }

  if (Object.prototype.hasOwnProperty.call(body, "serviceId")) {
    const serviceId = typeof body.serviceId === "string" ? body.serviceId.trim() : "";
    if (serviceId) {
      await ensureServiceExists(serviceId);
    }
    data.serviceId = serviceId || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "sortOrder")) {
    data.sortOrder = normalizeSortOrder(body.sortOrder);
  }

  if (typeof body.enabled === "boolean") {
    data.enabled = body.enabled;
  }

  const announcement = await prisma.announcement.update({
    where: { id },
    data
  });

  await writeAuditLog({
    actorId: admin.profile.id,
    action: "admin.announcement.updated",
    targetType: "Announcement",
    targetId: announcement.id,
    metadata: {
      enabled: announcement.enabled,
      serviceId: announcement.serviceId
    }
  });

  return { announcement };
});
