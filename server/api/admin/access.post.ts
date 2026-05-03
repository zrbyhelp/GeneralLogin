import { createError } from "h3";
import { requireAdminUser } from "~/server/utils/auth";
import { prisma } from "~/server/utils/prisma";
import { writeAuditLog } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event);
  const body = await readBody<{
    userId?: string;
    serviceId?: string;
    allowed?: boolean;
  }>(event);

  if (!body.userId || !body.serviceId) {
    throw createError({ statusCode: 400, statusMessage: "缺少用户或服务 ID" });
  }

  const access = await prisma.userServiceAccess.upsert({
    where: {
      userId_serviceId: {
        userId: body.userId,
        serviceId: body.serviceId
      }
    },
    update: {
      allowed: body.allowed !== false
    },
    create: {
      userId: body.userId,
      serviceId: body.serviceId,
      allowed: body.allowed !== false
    }
  });

  await writeAuditLog({
    actorId: admin.profile.id,
    action: "admin.service_access.updated",
    targetType: "UserServiceAccess",
    targetId: access.id,
    metadata: {
      userId: body.userId,
      serviceId: body.serviceId,
      allowed: access.allowed
    }
  });

  return { access };
});
