import { AccessRequestStatus, UserStatus } from "@prisma/client";
import { createError } from "h3";
import { requirePortalUser } from "~/server/utils/auth";
import { sha256 } from "~/server/utils/crypto";
import { prisma } from "~/server/utils/prisma";
import { writeAuditLog } from "~/server/utils/audit";

async function findService(params: { clientId?: string; serviceId?: string }) {
  if (!params.clientId && !params.serviceId) {
    return null;
  }

  return prisma.serviceApp.findFirst({
    where: {
      enabled: true,
      OR: [
        params.clientId ? { clientId: params.clientId } : undefined,
        params.serviceId ? { id: params.serviceId } : undefined
      ].filter(Boolean) as never
    }
  });
}

export default defineEventHandler(async (event) => {
  const { profile } = await requirePortalUser(event);
  const body = await readBody<{
    inviteCode?: string;
    message?: string;
    clientId?: string;
    serviceId?: string;
  }>(event);

  if (profile.status === UserStatus.SUSPENDED) {
    throw createError({ statusCode: 403, statusMessage: "账号已停用" });
  }

  if (body.inviteCode?.trim()) {
    const invite = await prisma.inviteCode.findUnique({
      where: { codeHash: sha256(body.inviteCode.trim()) },
      include: {
        services: {
          include: { service: true }
        }
      }
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

    const services = invite.services
      .map((item) => item.service)
      .filter((service) => service.enabled && service.allowInviteAccess);

    if (!services.length) {
      throw createError({ statusCode: 400, statusMessage: "邀请码未绑定可用网站" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.inviteCode.update({
        where: { id: invite.id },
        data: { usedCount: { increment: 1 } }
      });

      await tx.userServiceAccess.createMany({
        data: services.map((service) => ({
          userId: profile.id,
          serviceId: service.id,
          allowed: true
        })),
        skipDuplicates: true
      });
    });

    await writeAuditLog({
      actorId: profile.id,
      action: "user.invite.accepted",
      targetType: "InviteCode",
      targetId: invite.id,
      metadata: {
        serviceIds: services.map((service) => service.id)
      }
    });

    return {
      status: "approved",
      serviceIds: services.map((service) => service.id)
    };
  }

  const service = await findService({
    clientId: body.clientId,
    serviceId: body.serviceId
  });

  if (!service) {
    throw createError({ statusCode: 400, statusMessage: "请选择要申请的网站" });
  }

  if (!service.allowAccessRequest) {
    throw createError({ statusCode: 403, statusMessage: "此服务未开放申请" });
  }

  const message = body.message?.trim();
  if (!message) {
    throw createError({ statusCode: 400, statusMessage: "请填写申请说明或邀请码" });
  }

  const existing = await prisma.accessRequest.findFirst({
    where: {
      requesterId: profile.id,
      serviceId: service.id,
      status: AccessRequestStatus.PENDING
    },
    orderBy: { createdAt: "desc" }
  });

  const request =
    existing ??
    (await prisma.accessRequest.create({
      data: {
        requesterId: profile.id,
        serviceId: service.id,
        message
      }
    }));

  await writeAuditLog({
    actorId: profile.id,
    action: "access_request.created",
    targetType: "AccessRequest",
    targetId: request.id,
    metadata: { serviceId: service.id }
  });

  return { status: "pending", requestId: request.id };
});
