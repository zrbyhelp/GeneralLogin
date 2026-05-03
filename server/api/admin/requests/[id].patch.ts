import { AccessRequestStatus, UserStatus } from "@prisma/client";
import { createError } from "h3";
import { requireAdminUser } from "~/server/utils/auth";
import { prisma } from "~/server/utils/prisma";
import { writeAuditLog } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event);
  const id = getRouterParam(event, "id");
  const body = await readBody<{
    status?: AccessRequestStatus;
  }>(event);

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "缺少申请 ID" });
  }

  if (
    !body.status ||
    ![AccessRequestStatus.APPROVED, AccessRequestStatus.REJECTED].includes(
      body.status
    )
  ) {
    throw createError({ statusCode: 400, statusMessage: "申请状态无效" });
  }

  const request = await prisma.accessRequest.findUnique({
    where: { id },
    include: { requester: true }
  });

  if (!request) {
    throw createError({ statusCode: 404, statusMessage: "申请不存在" });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.accessRequest.update({
      where: { id },
      data: {
        status: body.status,
        reviewedAt: new Date(),
        reviewedById: admin.profile.id
      }
    });

    if (body.status === AccessRequestStatus.APPROVED) {
      await tx.userProfile.update({
        where: { id: request.requesterId },
        data: {
          status: UserStatus.APPROVED,
          approvedAt: new Date(),
          approvedById: admin.profile.id
        }
      });

      if (request.serviceId) {
        await tx.userServiceAccess.upsert({
          where: {
            userId_serviceId: {
              userId: request.requesterId,
              serviceId: request.serviceId
            }
          },
          update: { allowed: true },
          create: {
            userId: request.requesterId,
            serviceId: request.serviceId,
            allowed: true
          }
        });
      }
    }

    return result;
  });

  await writeAuditLog({
    actorId: admin.profile.id,
    action: "admin.access_request.reviewed",
    targetType: "AccessRequest",
    targetId: updated.id,
    metadata: { status: body.status, serviceId: request.serviceId }
  });

  return { request: updated };
});
