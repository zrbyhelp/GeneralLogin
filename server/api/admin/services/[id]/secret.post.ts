import { createError } from "h3";
import { requireAdminUser } from "~/server/utils/auth";
import { generateToken, sha256 } from "~/server/utils/crypto";
import { prisma } from "~/server/utils/prisma";
import { writeAuditLog } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "缺少服务 ID" });
  }

  const clientSecret = `sk_${generateToken(32)}`;
  const service = await prisma.serviceApp.update({
    where: { id },
    data: {
      clientSecretHash: sha256(clientSecret)
    }
  });

  await writeAuditLog({
    actorId: admin.profile.id,
    action: "admin.service.secret_rotated",
    targetType: "ServiceApp",
    targetId: service.id
  });

  return { clientSecret };
});
