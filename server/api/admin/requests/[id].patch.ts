import { AccessRequestStatus } from "@prisma/client";
import { createError } from "h3";
import { requireAdminUser } from "~/server/utils/auth";
import { prisma } from "~/server/utils/prisma";
import { writeAuditLog } from "~/server/utils/audit";

const REVIEWABLE_STATUSES: AccessRequestStatus[] = [
  AccessRequestStatus.APPROVED,
  AccessRequestStatus.REJECTED
];

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
    !REVIEWABLE_STATUSES.includes(body.status)
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
      if (!request.serviceId) {
        throw createError({
          statusCode: 400,
          statusMessage: "旧的全局申请无法通过，请让用户重新选择网站提交申请"
        });
      }

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
