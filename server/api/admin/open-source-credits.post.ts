import { createError } from "h3";
import { requireAdminUser } from "~/server/utils/auth";
import { tryNormalizeUrl } from "~/server/utils/crypto";
import { prisma } from "~/server/utils/prisma";
import { writeAuditLog } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event);
  const body = await readBody<{
    name?: string;
    url?: string;
    sortOrder?: number;
    enabled?: boolean;
  }>(event);

  const name = body.name?.trim();
  const url = body.url?.trim();

  if (!name || !url) {
    throw createError({ statusCode: 400, statusMessage: "名称和地址为必填" });
  }
  if (!tryNormalizeUrl(url)) {
    throw createError({ statusCode: 400, statusMessage: "开源地址格式无效" });
  }

  const credit = await prisma.openSourceCredit.create({
    data: {
      name,
      url,
      sortOrder: Number(body.sortOrder || 0),
      enabled: body.enabled !== false
    }
  });

  await writeAuditLog({
    actorId: admin.profile.id,
    action: "admin.open_source_credit.created",
    targetType: "OpenSourceCredit",
    targetId: credit.id,
    metadata: { name }
  });

  return { credit };
});
