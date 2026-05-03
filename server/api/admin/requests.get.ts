import { requireAdminUser } from "~/server/utils/auth";
import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);

  const requests = await prisma.accessRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      requester: {
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          status: true
        }
      },
      service: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      reviewedBy: {
        select: {
          email: true,
          name: true
        }
      }
    },
    take: 200
  });

  return { requests };
});
