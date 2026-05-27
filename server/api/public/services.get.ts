import { prisma } from "~/server/utils/prisma";

function safeHost(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
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
      clientId: true,
      description: true,
      displayTitle: true,
      shortIntro: true,
      coverImageUrl: true,
      videoUrl: true,
      mediaType: true,
      tags: true,
      showcaseOrder: true,
      featured: true,
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
      clientId: service.clientId,
      description: service.description,
      displayTitle: service.displayTitle,
      shortIntro: service.shortIntro,
      coverImageUrl: service.coverImageUrl,
      videoUrl: service.videoUrl,
      mediaType: service.mediaType,
      tags: normalizeTags(service.tags),
      showcaseOrder: service.showcaseOrder,
      featured: service.featured,
      host: safeHost(service.homeUrl),
      docsUrl: service.docsUrl,
      status: await checkServiceHealth(service.healthCheckUrl)
    }))
  );

  return {
    services: items.sort((a, b) => a.showcaseOrder - b.showcaseOrder || a.name.localeCompare(b.name))
  };
});
