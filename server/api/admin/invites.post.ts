import { createError } from "h3";
import { requireAdminUser } from "~/server/utils/auth";
import { generateToken, sha256 } from "~/server/utils/crypto";
import { prisma } from "~/server/utils/prisma";
import { writeAuditLog } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event);
  const body = await readBody<{
    label?: string;
    maxUses?: number;
    expiresAt?: string;
    serviceIds?: string[];
  }>(event);

  const label = body.label?.trim();
  if (!label) {
    throw createError({ statusCode: 400, statusMessage: "请填写邀请码名称" });
  }

  const serviceIds = Array.isArray(body.serviceIds)
    ? [...new Set(body.serviceIds.filter((id): id is string => typeof id === "string" && Boolean(id)))]
    : [];
  if (!serviceIds.length) {
    throw createError({ statusCode: 400, statusMessage: "请选择邀请码可授权的网站" });
  }

  const services = await prisma.serviceApp.findMany({
    where: {
      id: { in: serviceIds },
      enabled: true,
      allowInviteAccess: true
    },
    select: { id: true }
  });

  if (services.length !== serviceIds.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "选择的网站不存在、未启用或未开放邀请码"
    });
  }

  const code = `ZR-${generateToken(12).toUpperCase()}`;
  const invite = await prisma.inviteCode.create({
    data: {
      label,
      codeHash: sha256(code),
      maxUses: Math.max(1, Number(body.maxUses || 1)),
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      createdById: admin.profile.id,
      services: {
        create: services.map((service) => ({
          serviceId: service.id
        }))
      }
    }
  });

  await writeAuditLog({
    actorId: admin.profile.id,
    action: "admin.invite.created",
    targetType: "InviteCode",
    targetId: invite.id,
    metadata: { label, serviceIds: services.map((service) => service.id) }
  });

  return { invite, code };
});
