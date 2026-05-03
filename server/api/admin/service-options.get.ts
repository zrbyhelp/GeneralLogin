import { requireAdminUser } from "~/server/utils/auth";
import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);

  const services = await prisma.serviceApp.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      enabled: true,
      allowDirectAccess: true,
      allowInviteAccess: true,
      allowAccessRequest: true
    }
  });

  return { services };
});
