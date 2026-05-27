import type { Prisma } from "@prisma/client";
import { requireAdminUser } from "~/server/utils/auth";
import { getQueryString, parseAdminListQuery, parseBooleanFilter } from "~/server/utils/admin-list";
import { parseCallbackUrls } from "~/server/utils/service-auth";
import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);

  const { query, keyword, pageSize, skip } = parseAdminListQuery(event);
  const enabled = parseBooleanFilter(getQueryString(query, "enabled"));
  const accessMode = getQueryString(query, "accessMode");
  const where: Prisma.ServiceAppWhereInput = {};

  if (keyword) {
    where.OR = [
      { name: { contains: keyword } },
      { slug: { contains: keyword } },
      { description: { contains: keyword } },
      { displayTitle: { contains: keyword } },
      { shortIntro: { contains: keyword } },
      { clientId: { contains: keyword } },
      { homeUrl: { contains: keyword } }
    ];
  }

  if (typeof enabled === "boolean") {
    where.enabled = enabled;
  }

  if (accessMode === "direct") {
    where.allowDirectAccess = true;
  } else if (accessMode === "invite") {
    where.allowInviteAccess = true;
  } else if (accessMode === "request") {
    where.allowAccessRequest = true;
  }

  const [total, services] = await prisma.$transaction([
    prisma.serviceApp.count({ where }),
    prisma.serviceApp.findMany({
      where,
      orderBy: [{ showcaseOrder: "asc" }, { createdAt: "desc" }],
      include: {
        access: {
          where: { allowed: true },
          select: { id: true }
        }
      },
      skip,
      take: pageSize
    })
  ]);

  return {
    total,
    services: services.map((service) => ({
      id: service.id,
      name: service.name,
      slug: service.slug,
      description: service.description,
      displayTitle: service.displayTitle,
      shortIntro: service.shortIntro,
      coverImageUrl: service.coverImageUrl,
      videoUrl: service.videoUrl,
      mediaType: service.mediaType,
      tags: Array.isArray(service.tags) ? service.tags : [],
      showcaseOrder: service.showcaseOrder,
      featured: service.featured,
      homeUrl: service.homeUrl,
      healthCheckUrl: service.healthCheckUrl,
      docsUrl: service.docsUrl,
      callbackUrls: parseCallbackUrls(service.callbackUrls),
      clientId: service.clientId,
      enabled: service.enabled,
      allowDirectAccess: service.allowDirectAccess,
      allowInviteAccess: service.allowInviteAccess,
      allowAccessRequest: service.allowAccessRequest,
      accessCount: service.access.length,
      createdAt: service.createdAt
    }))
  };
});
