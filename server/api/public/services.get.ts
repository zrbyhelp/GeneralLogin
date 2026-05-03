import { prisma } from "~/server/utils/prisma";

function safeHost(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}

async function checkServiceHealth(url?: string | null) {
  if (!url) {
    return "online";
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(2500)
    });

    return response.status >= 200 && response.status < 400 ? "online" : "offline";
  } catch {
    return "offline";
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
      homeUrl: true,
      healthCheckUrl: true,
      docsUrl: true
    }
  });

  const items = await Promise.all(
    services.map(async (service) => ({
      id: service.id,
      name: service.name,
      slug: service.slug,
      host: safeHost(service.homeUrl),
      docsUrl: service.docsUrl,
      status: await checkServiceHealth(service.healthCheckUrl)
    }))
  );

  return {
    services: items
  };
});
