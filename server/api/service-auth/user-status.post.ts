import { createError } from "h3";
import { UserStatus } from "@prisma/client";
import { getServiceAccessState, requireServiceClient } from "~/server/utils/service-auth";
import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    clientId?: string;
    clientSecret?: string;
    userId?: string;
  }>(event);

  if (!body.clientId || !body.clientSecret || !body.userId) {
    throw createError({
      statusCode: 400,
      statusMessage: "clientId、clientSecret、userId 为必填"
    });
  }

  const service = await requireServiceClient({
    clientId: body.clientId,
    clientSecret: body.clientSecret
  });

  const user = await prisma.userProfile.findUnique({
    where: { id: body.userId }
  });

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "用户不存在" });
  }

  const accessState = await getServiceAccessState(user, service);
  const enabled = user.status !== UserStatus.SUSPENDED;

  return {
    ok: true,
    userId: user.id,
    enabled,
    status: enabled ? "ACTIVE" : "SUSPENDED",
    serviceAccess: accessState.canAccess
  };
});
