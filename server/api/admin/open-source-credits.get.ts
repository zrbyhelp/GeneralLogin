import type { Prisma } from "@prisma/client";
import { requireAdminUser } from "~/server/utils/auth";
import { getQueryString, parseAdminListQuery, parseBooleanFilter } from "~/server/utils/admin-list";
import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);

  const { query, keyword, pageSize, skip } = parseAdminListQuery(event);
  const enabled = parseBooleanFilter(getQueryString(query, "enabled"));
  const where: Prisma.OpenSourceCreditWhereInput = {};

  if (keyword) {
    where.OR = [
      { name: { contains: keyword } },
      { url: { contains: keyword } }
    ];
  }

  if (typeof enabled === "boolean") {
    where.enabled = enabled;
  }

  const [total, credits] = await prisma.$transaction([
    prisma.openSourceCredit.count({ where }),
    prisma.openSourceCredit.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip,
      take: pageSize
    })
  ]);

  return { credits, total };
});
