import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async () => {
  const credits = await prisma.openSourceCredit.findMany({
    where: { enabled: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      url: true
    }
  });

  return { credits };
});
