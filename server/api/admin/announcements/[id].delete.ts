import { createError } from "h3";
import { requireAdminUser } from "~/server/utils/auth";
import { prisma } from "~/server/utils/prisma";
import { writeAuditLog } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "缺少公告 ID" });
  }

  await prisma.announcement.delete({ where: { id } });

  await writeAuditLog({
    actorId: admin.profile.id,
    action: "admin.announcement.deleted",
    targetType: "Announcement",
    targetId: id
  });

  return { ok: true };
});
