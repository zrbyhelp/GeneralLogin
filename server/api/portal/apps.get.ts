import { ensureApprovedAccess, requirePortalUser } from "~/server/utils/auth";
import { parseCallbackUrls } from "~/server/utils/service-auth";
import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const { profile } = await requirePortalUser(event);
  await ensureApprovedAccess(profile);

  const services = await prisma.serviceApp.findMany({
    where: { enabled: true },
    orderBy: { name: "asc" },
    include: {
      access: profile.isAdminSnapshot
        ? false
        : {
            where: {
              userId: profile.id,
              allowed: true
            }
          }
    }
  });

  return {
    apps: services
      .filter((service) => profile.isAdminSnapshot || service.access.length > 0)
      .map((service) => {
        const callbackUrls = parseCallbackUrls(service.callbackUrls);

        return {
          id: service.id,
          name: service.name,
          slug: service.slug,
          description: service.description,
          homeUrl: service.homeUrl,
          defaultCallbackUrl: callbackUrls[0] ?? "",
          callbackUrls
        };
      })
  };
});
