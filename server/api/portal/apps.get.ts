import { ensureActiveUser, requirePortalUser } from "~/server/utils/auth";
import { getServiceAccessState, parseCallbackUrls } from "~/server/utils/service-auth";
import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const { profile } = await requirePortalUser(event);
  await ensureActiveUser(profile);

  const services = await prisma.serviceApp.findMany({
    where: { enabled: true },
    orderBy: { name: "asc" },
  });

  return {
    apps: await Promise.all(
      services.map(async (service) => {
        const callbackUrls = parseCallbackUrls(service.callbackUrls);
        const accessState = await getServiceAccessState(profile, service);

        return {
          id: service.id,
          name: service.name,
          slug: service.slug,
          clientId: service.clientId,
          description: service.description,
          homeUrl: service.homeUrl,
          defaultCallbackUrl: callbackUrls[0] ?? "",
          callbackUrls,
          allowDirectAccess: service.allowDirectAccess,
          allowInviteAccess: service.allowInviteAccess,
          allowAccessRequest: service.allowAccessRequest,
          ...accessState
        };
      })
    )
  };
});
