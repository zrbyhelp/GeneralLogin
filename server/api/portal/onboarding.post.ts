import { AccessRequestStatus, UserStatus } from "@prisma/client";
import { createError } from "h3";
import { requirePortalUser } from "~/server/utils/auth";
import { sha256 } from "~/server/utils/crypto";
import { prisma } from "~/server/utils/prisma";
import { writeAuditLog } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const { profile } = await requirePortalUser(event);
  const body = await readBody<{
    inviteCode?: string;
    message?: string;
    clientId?: string;
    serviceId?: string;
  }>(event);

  const service = body.clientId || body.serviceId
    ? await prisma.serviceApp.findFirst({
        where: {
          OR: [
            body.clientId ? { clientId: body.clientId } : undefined,
            body.serviceId ? { id: body.serviceId } : undefined
          ].filter(Boolean) as never
        }
      })
    : null;

  if (profile.status === UserStatus.SUSPENDED) {
    throw createError({ statusCode: 403, statusMessage: "账号已停用" });
  }

  if (body.inviteCode?.trim()) {
    const invite = await prisma.inviteCode.findUnique({
      where: { codeHash: sha256(body.inviteCode.trim()) }
    });

    if (!invite || !invite.enabled) {
      throw createError({ statusCode: 400, statusMessage: "邀请码无效" });
    }

    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      throw createError({ statusCode: 400, statusMessage: "邀请码已过期" });
    }

    if (invite.usedCount >= invite.maxUses) {
      throw createError({ statusCode: 400, statusMessage: "邀请码已使用完" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.inviteCode.update({
        where: { id: invite.id },
        data: { usedCount: { increment: 1 } }
      });

      await tx.userProfile.update({
        where: { id: profile.id },
        data: {
          status: UserStatus.APPROVED,
          approvedAt: new Date()
        }
      });

      if (invite.grantsAllServices) {
        const services = await tx.serviceApp.findMany({
          where: { enabled: true },
          select: { id: true }
        });

        await tx.userServiceAccess.createMany({
          data: services.map((item) => ({
            userId: profile.id,
            serviceId: item.id,
            allowed: true
          })),
          skipDuplicates: true
        });
      }

      if (service && !invite.grantsAllServices) {
        const existing = await tx.accessRequest.findFirst({
          where: {
            requesterId: profile.id,
            serviceId: service.id,
            status: AccessRequestStatus.PENDING
          }
        });

        if (!existing) {
          await tx.accessRequest.create({
            data: {
              requesterId: profile.id,
              serviceId: service.id,
              message: "用户使用邀请码加入后申请访问此服务。"
            }
          });
        }
      }
    });

    await writeAuditLog({
      actorId: profile.id,
      action: "user.invite.accepted",
      targetType: "InviteCode",
      targetId: invite.id
    });

    return { status: "approved", grantsAllServices: invite.grantsAllServices };
  }

  const message = body.message?.trim();
  if (!message) {
    throw createError({ statusCode: 400, statusMessage: "请填写申请说明或邀请码" });
  }

  const existing = await prisma.accessRequest.findFirst({
    where: {
      requesterId: profile.id,
      serviceId: service?.id ?? null,
      status: AccessRequestStatus.PENDING
    },
    orderBy: { createdAt: "desc" }
  });

  const request =
    existing ??
    (await prisma.accessRequest.create({
      data: {
        requesterId: profile.id,
        serviceId: service?.id ?? null,
        message
      }
    }));

  await writeAuditLog({
    actorId: profile.id,
    action: "access_request.created",
    targetType: "AccessRequest",
    targetId: request.id,
    metadata: { serviceId: service?.id ?? null }
  });

  return { status: "pending", requestId: request.id };
});
