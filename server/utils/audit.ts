import { Prisma } from "@prisma/client";
import { prisma } from "~/server/utils/prisma";

export async function writeAuditLog(params: {
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      metadata:
        params.metadata === undefined
          ? undefined
          : (params.metadata as Prisma.InputJsonValue)
    }
  });
}
