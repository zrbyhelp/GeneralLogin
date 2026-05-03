import { createError } from "h3";
import { requireAdminUser } from "~/server/utils/auth";
import { prisma } from "~/server/utils/prisma";
import { writeAuditLog } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "缺少开源项 ID" });
  }

  await prisma.openSourceCredit.delete({ where: { id } });

  await writeAuditLog({
    actorId: admin.profile.id,
    action: "admin.open_source_credit.deleted",
    targetType: "OpenSourceCredit",
    targetId: id
  });

  return { ok: true };
});
