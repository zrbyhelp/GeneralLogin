import { requireAdminUser } from "~/server/utils/auth";
import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);

  const credits = await prisma.openSourceCredit.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
  });

  return { credits };
});
