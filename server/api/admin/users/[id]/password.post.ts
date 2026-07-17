import { createError } from "h3";
import { requireAdminUser } from "~/server/utils/auth";
import { writeAuditLog } from "~/server/utils/audit";
import { hashPassword, validatePassword } from "~/server/utils/password";
import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event);
  const id = getRouterParam(event, "id");
  const body = await readBody<{ newPassword?: string }>(event);
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "缺少用户 ID" });
  }

  if (!newPassword) {
    throw createError({ statusCode: 400, statusMessage: "请输入新密码" });
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    throw createError({ statusCode: 400, statusMessage: passwordError });
  }

  const passwordHash = await hashPassword(newPassword);
  const [user, revokedSessions] = await prisma.$transaction([
    prisma.userProfile.update({
      where: { id },
      data: { passwordHash }
    }),
    prisma.authSession.deleteMany({
      where: { userId: id }
    })
  ]);

  await writeAuditLog({
    actorId: admin.profile.id,
    action: "admin.user.password_reset",
    targetType: "UserProfile",
    targetId: user.id,
    metadata: { revokedSessionCount: revokedSessions.count }
  });

  return {
    currentSessionRevoked: user.id === admin.profile.id
  };
});
