import type { Prisma, UserStatus } from "@prisma/client";
import { requireAdminUser } from "~/server/utils/auth";
import { getQueryString, parseAdminListQuery } from "~/server/utils/admin-list";
import { prisma } from "~/server/utils/prisma";

const USER_STATUSES = ["ACTIVE", "PENDING", "APPROVED", "SUSPENDED"];

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);

  const { query, keyword, pageSize, skip } = parseAdminListQuery(event);
  const status = getQueryString(query, "status");
  const serviceId = getQueryString(query, "serviceId");
  const where: Prisma.UserProfileWhereInput = {};

  if (keyword) {
    where.OR = [
      { account: { contains: keyword } },
      { email: { contains: keyword } },
      { username: { contains: keyword } },
      { name: { contains: keyword } }
    ];
  }

  if (USER_STATUSES.includes(status)) {
    where.status = status as UserStatus;
  }

  if (serviceId) {
    where.serviceAccess = {
      some: {
        serviceId,
        allowed: true
      }
    };
  }

  const [total, users] = await prisma.$transaction([
    prisma.userProfile.count({ where }),
    prisma.userProfile.findMany({
      where,
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
      skip,
      take: pageSize
    })
  ]);

  return {
    total,
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
