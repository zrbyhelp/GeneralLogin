import type { AccessRequestStatus, Prisma } from "@prisma/client";
import { requireAdminUser } from "~/server/utils/auth";
import { getQueryString, parseAdminListQuery } from "~/server/utils/admin-list";
import { prisma } from "~/server/utils/prisma";

const REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED"];

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);

  const { query, keyword, pageSize, skip } = parseAdminListQuery(event);
  const status = getQueryString(query, "status");
  const serviceId = getQueryString(query, "serviceId");
  const where: Prisma.AccessRequestWhereInput = {};

  if (keyword) {
    where.OR = [
      { message: { contains: keyword } },
      { requester: { account: { contains: keyword } } },
      { requester: { email: { contains: keyword } } },
      { requester: { username: { contains: keyword } } },
      { requester: { name: { contains: keyword } } },
      { service: { is: { name: { contains: keyword } } } },
      { service: { is: { slug: { contains: keyword } } } }
    ];
  }

  if (REQUEST_STATUSES.includes(status)) {
    where.status = status as AccessRequestStatus;
  }

  if (serviceId) {
    where.serviceId = serviceId;
  }

  const [total, requests] = await prisma.$transaction([
    prisma.accessRequest.count({ where }),
    prisma.accessRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        requester: {
          select: {
            id: true,
            account: true,
            email: true,
            username: true,
            name: true,
            status: true
          }
        },
        service: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        reviewedBy: {
          select: {
            account: true,
            email: true,
            name: true
          }
        }
      },
      skip,
      take: pageSize
    })
  ]);

  return { requests, total };
});
