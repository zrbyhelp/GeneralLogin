import { requireAdminUser } from "~/server/utils/auth";
import { parseCallbackUrls } from "~/server/utils/service-auth";
import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);

  const services = await prisma.serviceApp.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      access: {
        where: { allowed: true },
        select: { id: true }
      }
    }
  });

  return {
    services: services.map((service) => ({
      id: service.id,
      name: service.name,
      slug: service.slug,
      description: service.description,
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
