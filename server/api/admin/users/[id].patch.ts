import { UserStatus } from "@prisma/client";
import { createError } from "h3";
import { requireAdminUser } from "~/server/utils/auth";
import { prisma } from "~/server/utils/prisma";
import { writeAuditLog } from "~/server/utils/audit";

const UPDATABLE_USER_STATUSES: UserStatus[] = [
  UserStatus.ACTIVE,
  UserStatus.SUSPENDED
];

export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event);
  const id = getRouterParam(event, "id");
  const body = await readBody<{
    status?: UserStatus;
  }>(event);

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "缺少用户 ID" });
  }

  if (
    body.status &&
    !UPDATABLE_USER_STATUSES.includes(body.status)
  ) {
    throw createError({ statusCode: 400, statusMessage: "用户状态无效" });
  }

  const user = await prisma.userProfile.update({
    where: { id },
    data: {
      status: body.status
    }
  });

  await writeAuditLog({
    actorId: admin.profile.id,
    action: "admin.user.updated",
    targetType: "UserProfile",
    targetId: user.id,
    metadata: { status: body.status }
  });

  return { user };
});
