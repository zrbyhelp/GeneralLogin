import { prisma } from "~/server/utils/prisma";

function safeHost(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}

export default defineEventHandler(async () => {
  const services = await prisma.serviceApp.findMany({
    where: { enabled: true },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      homeUrl: true
    }
  });

  return {
    services: services.map((service) => ({
      id: service.id,
      name: service.name,
      slug: service.slug,
      host: safeHost(service.homeUrl)
    }))
  };
});
