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
    grantsAllServices?: boolean;
  }>(event);

  const label = body.label?.trim();
  if (!label) {
    throw createError({ statusCode: 400, statusMessage: "请填写邀请码名称" });
  }

  const code = `ZR-${generateToken(12).toUpperCase()}`;
  const invite = await prisma.inviteCode.create({
    data: {
      label,
      codeHash: sha256(code),
      maxUses: Math.max(1, Number(body.maxUses || 1)),
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      grantsAllServices: Boolean(body.grantsAllServices),
      createdById: admin.profile.id
    }
  });

  await writeAuditLog({
    actorId: admin.profile.id,
    action: "admin.invite.created",
    targetType: "InviteCode",
    targetId: invite.id,
    metadata: { label }
  });

  return { invite, code };
});
