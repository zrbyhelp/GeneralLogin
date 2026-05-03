import type { Prisma } from "@prisma/client";
import { requireAdminUser } from "~/server/utils/auth";
import { getQueryString, parseAdminListQuery, parseBooleanFilter } from "~/server/utils/admin-list";
import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);

  const { query, keyword, pageSize, skip } = parseAdminListQuery(event);
  const enabled = parseBooleanFilter(getQueryString(query, "enabled"));
  const serviceId = getQueryString(query, "serviceId");
  const where: Prisma.InviteCodeWhereInput = {};

  if (keyword) {
    where.OR = [
      { label: { contains: keyword } },
      { createdBy: { is: { account: { contains: keyword } } } },
      { createdBy: { is: { email: { contains: keyword } } } },
      { createdBy: { is: { name: { contains: keyword } } } }
    ];
  }

  if (typeof enabled === "boolean") {
    where.enabled = enabled;
  }

  if (serviceId) {
    where.services = {
      some: { serviceId }
    };
  }

  const [total, invites] = await prisma.$transaction([
    prisma.inviteCode.count({ where }),
    prisma.inviteCode.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: {
            account: true,
            email: true,
            name: true
          }
        },
        services: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                slug: true,
                enabled: true,
                allowInviteAccess: true
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
    invites: invites.map((invite) => ({
      id: invite.id,
      label: invite.label,
      enabled: invite.enabled,
      maxUses: invite.maxUses,
      usedCount: invite.usedCount,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      createdBy: invite.createdBy,
      services: invite.services.map((item) => item.service)
    }))
  };
});
