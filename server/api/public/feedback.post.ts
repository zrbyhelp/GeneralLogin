import { createError } from "h3";
import { getPortalUser } from "~/server/utils/auth";
import { tryNormalizeUrl } from "~/server/utils/crypto";
import { prisma } from "~/server/utils/prisma";

function cleanText(value: unknown, maxLength: number, label: string) {
  if (typeof value !== "string") {
    return "";
  }

  const text = value.trim();
  if (text.length > maxLength) {
    throw createError({
      statusCode: 400,
      statusMessage: `${label}不能超过 ${maxLength} 个字符`
    });
  }

  return text;
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    type?: string;
    content?: string;
    contact?: string;
    serviceSlug?: string;
    serviceId?: string;
    userId?: string;
    sourceUrl?: string;
  }>(event);

  const type = cleanText(body.type || "suggestion", 32, "类型") || "suggestion";
  const content = cleanText(body.content, 2000, "内容");
  const contact = cleanText(body.contact, 200, "联系方式") || null;
  const sourceUrl = cleanText(body.sourceUrl, 2048, "来源地址") || null;

  if (!content) {
    throw createError({ statusCode: 400, statusMessage: "请输入投诉或建议内容" });
  }
  if (sourceUrl && !tryNormalizeUrl(sourceUrl)) {
    throw createError({ statusCode: 400, statusMessage: "来源地址格式无效" });
  }

  const session = await getPortalUser(event).catch(() => null);
  const service = body.serviceId || body.serviceSlug
    ? await prisma.serviceApp.findFirst({
        where: {
          OR: [
            body.serviceId ? { id: body.serviceId } : undefined,
            body.serviceSlug ? { slug: body.serviceSlug } : undefined
          ].filter(Boolean) as never
        },
        select: { id: true }
      })
    : null;
  const queryUser = !session?.profile.id && body.userId
    ? await prisma.userProfile.findUnique({
        where: { id: body.userId },
        select: { id: true }
      })
    : null;

  const feedback = await prisma.feedback.create({
    data: {
      type,
      content,
      contact,
      sourceUrl,
      serviceId: service?.id || null,
      userId: session?.profile.id || queryUser?.id || null
    }
  });

  return {
    ok: true,
    feedback: {
      id: feedback.id,
      status: feedback.status
    }
  };
});
