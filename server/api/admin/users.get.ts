import { requireAdminUser } from "~/server/utils/auth";
import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);

  const users = await prisma.userProfile.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      serviceAccess: {
        include: {
          service: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      }
    },
    take: 200
  });

  return {
    users: users.map((user) => ({
      id: user.id,
      account: user.account,
      email: user.email,
      username: user.username,
      name: user.name,
      avatarUrl: user.avatarUrl,
      status: user.status,
      isAdmin: user.isAdminSnapshot,
      createdAt: user.createdAt,
      serviceAccess: user.serviceAccess.map((access) => ({
        id: access.id,
        serviceId: access.serviceId,
        allowed: access.allowed,
        service: access.service
      }))
    }))
  };
});
