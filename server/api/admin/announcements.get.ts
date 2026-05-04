import type { Prisma } from "@prisma/client";
import { requireAdminUser } from "~/server/utils/auth";
import { getQueryString, parseAdminListQuery, parseBooleanFilter } from "~/server/utils/admin-list";
import { prisma } from "~/server/utils/prisma";

const GLOBAL_SERVICE_FILTER = "__global";

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);

  const { query, keyword, pageSize, skip } = parseAdminListQuery(event);
  const enabled = parseBooleanFilter(getQueryString(query, "enabled"));
  const serviceId = getQueryString(query, "serviceId");
  const where: Prisma.AnnouncementWhereInput = {};

  if (keyword) {
    where.OR = [
      { title: { contains: keyword } },
      { content: { contains: keyword } }
    ];
  }

  if (typeof enabled === "boolean") {
    where.enabled = enabled;
  }

  if (serviceId === GLOBAL_SERVICE_FILTER) {
    where.serviceId = null;
  } else if (serviceId) {
    where.serviceId = serviceId;
  }

  const [total, announcements] = await prisma.$transaction([
    prisma.announcement.count({ where }),
    prisma.announcement.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        service: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      skip,
      take: pageSize
    })
  ]);

  return { announcements, total };
});
