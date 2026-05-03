import { AccessRequestStatus, UserStatus } from "@prisma/client";
import { requireAdminUser } from "~/server/utils/auth";
import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);

  const [users, suspendedUsers, services, pendingRequests, invites] =
    await Promise.all([
      prisma.userProfile.count(),
      prisma.userProfile.count({ where: { status: UserStatus.SUSPENDED } }),
      prisma.serviceApp.count(),
      prisma.accessRequest.count({
        where: { status: AccessRequestStatus.PENDING }
      }),
      prisma.inviteCode.count({ where: { enabled: true } })
    ]);

  return { users, suspendedUsers, services, pendingRequests, invites };
});
