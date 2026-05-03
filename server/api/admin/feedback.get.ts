import type { FeedbackStatus, Prisma } from "@prisma/client";
import { requireAdminUser } from "~/server/utils/auth";
import { getQueryString, parseAdminListQuery } from "~/server/utils/admin-list";
import { prisma } from "~/server/utils/prisma";

const FEEDBACK_STATUSES = ["NEW", "REVIEWING", "RESOLVED"];

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);

  const { query, keyword, pageSize, skip } = parseAdminListQuery(event);
  const status = getQueryString(query, "status");
  const serviceId = getQueryString(query, "serviceId");
  const type = getQueryString(query, "type");
  const where: Prisma.FeedbackWhereInput = {};

  if (keyword) {
    where.OR = [
      { content: { contains: keyword } },
      { contact: { contains: keyword } },
      { sourceUrl: { contains: keyword } },
      { service: { is: { name: { contains: keyword } } } },
      { service: { is: { slug: { contains: keyword } } } },
      { user: { is: { account: { contains: keyword } } } },
      { user: { is: { email: { contains: keyword } } } },
      { user: { is: { username: { contains: keyword } } } },
      { user: { is: { name: { contains: keyword } } } }
    ];
  }

  if (FEEDBACK_STATUSES.includes(status)) {
    where.status = status as FeedbackStatus;
  }

  if (serviceId) {
    where.serviceId = serviceId;
  }

  if (["suggestion", "complaint", "bug"].includes(type)) {
    where.type = type;
  }

  const [total, feedback] = await prisma.$transaction([
    prisma.feedback.count({ where }),
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        user: {
          select: {
            id: true,
            account: true,
            email: true,
            username: true,
            name: true
          }
        },
        reviewedBy: {
          select: {
            id: true,
            account: true,
            name: true
          }
        }
      },
      skip,
      take: pageSize
    })
  ]);

  return { feedback, total };
});
