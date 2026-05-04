import { createError } from "h3";
import { requireServiceClient } from "~/server/utils/service-auth";
import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    clientId?: string;
    clientSecret?: string;
  }>(event);

  if (!body.clientId || !body.clientSecret) {
    throw createError({
      statusCode: 400,
      statusMessage: "clientId、clientSecret 为必填"
    });
  }

  const service = await requireServiceClient({
    clientId: body.clientId,
    clientSecret: body.clientSecret
  });

  const announcements = await prisma.announcement.findMany({
    where: {
      enabled: true,
      OR: [
        { serviceId: null },
        { serviceId: service.id }
      ]
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      content: true,
      serviceId: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return {
    ok: true,
    service: {
      id: service.id,
      slug: service.slug,
      name: service.name
    },
    announcements: announcements.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      scope: announcement.serviceId ? "service" : "global",
      serviceId: announcement.serviceId,
      sortOrder: announcement.sortOrder,
      createdAt: announcement.createdAt,
      updatedAt: announcement.updatedAt
    }))
  };
});
