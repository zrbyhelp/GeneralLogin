import { requireAdminUser } from "~/server/utils/auth";
import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);

  const feedback = await prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      service: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      user: {
        select: {
          id: true,
          account: true,
          email: true,
          username: true,
          name: true
        }
      },
      reviewedBy: {
        select: {
          id: true,
          account: true,
          name: true
        }
      }
    },
    take: 200
  });

  return { feedback };
});
