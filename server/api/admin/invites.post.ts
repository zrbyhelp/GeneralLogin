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
    generationMode?: "single" | "batch";
    quantity?: number;
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

  const maxUses = Math.max(1, Math.floor(Number(body.maxUses || 1)));
  const generationMode = body.generationMode === "batch" ? "batch" : "single";
  const rawQuantity = Number(body.quantity || 0);
  const quantity = generationMode === "batch" ? Math.floor(rawQuantity) : 1;

  if (generationMode === "batch") {
    if (!Number.isFinite(rawQuantity) || quantity < 2) {
      throw createError({ statusCode: 400, statusMessage: "批量生成数量至少为 2" });
    }

    if (quantity > 500) {
      throw createError({ statusCode: 400, statusMessage: "批量生成数量不能超过 500" });
    }
  }

  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw createError({ statusCode: 400, statusMessage: "过期时间格式无效" });
  }

  const codes: string[] = [];
  const invites = await prisma.$transaction(async (tx) => {
    const createdInvites: Array<{ id: string }> = [];

    for (let index = 0; index < quantity; index += 1) {
      const code = `ZR-${generateToken(12).toUpperCase()}`;
      const invite = await tx.inviteCode.create({
        data: {
          label,
          codeHash: sha256(code),
          maxUses,
          expiresAt,
          createdById: admin.profile.id,
          services: {
            create: services.map((service) => ({
              serviceId: service.id
            }))
          }
        }
      });

      createdInvites.push(invite);
      codes.push(code);
    }

    return createdInvites;
  });

  await writeAuditLog({
    actorId: admin.profile.id,
    action: "admin.invite.created",
    targetType: "InviteCode",
    targetId: invites[0]?.id || "",
    metadata: {
      label,
      serviceIds: services.map((service) => service.id),
      generationMode,
      quantity,
      maxUses
    }
  });

  if (generationMode === "batch") {
    return {
      invites,
      codes,
      createdCount: invites.length
    };
  }

  return { invite: invites[0], code: codes[0] };
});
