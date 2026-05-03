import { createError } from "h3";
import { requireAdminUser } from "~/server/utils/auth";
import { tryNormalizeUrl } from "~/server/utils/crypto";
import { prisma } from "~/server/utils/prisma";
import { writeAuditLog } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event);
  const id = getRouterParam(event, "id");
  const body = await readBody<{
    name?: string;
    url?: string;
    sortOrder?: number;
    enabled?: boolean;
  }>(event);

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "缺少开源项 ID" });
  }

  const url = typeof body.url === "string" ? body.url.trim() : undefined;
  if (url && !tryNormalizeUrl(url)) {
    throw createError({ statusCode: 400, statusMessage: "开源地址格式无效" });
  }

  const credit = await prisma.openSourceCredit.update({
    where: { id },
    data: {
      name: typeof body.name === "string" ? body.name.trim() || undefined : undefined,
      url,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined
    }
  });

  await writeAuditLog({
    actorId: admin.profile.id,
    action: "admin.open_source_credit.updated",
    targetType: "OpenSourceCredit",
    targetId: credit.id,
    metadata: { enabled: credit.enabled }
  });

  return { credit };
});
