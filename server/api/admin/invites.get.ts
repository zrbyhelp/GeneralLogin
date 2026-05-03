import { requireAdminUser } from "~/server/utils/auth";
import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);

  const invites = await prisma.inviteCode.findMany({
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
    take: 200
  });

  return {
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
