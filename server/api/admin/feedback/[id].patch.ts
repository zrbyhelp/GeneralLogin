import { FeedbackStatus } from "@prisma/client";
import { createError } from "h3";
import { requireAdminUser } from "~/server/utils/auth";
import { prisma } from "~/server/utils/prisma";
import { writeAuditLog } from "~/server/utils/audit";

const FEEDBACK_STATUSES: FeedbackStatus[] = [
  FeedbackStatus.NEW,
  FeedbackStatus.REVIEWING,
  FeedbackStatus.RESOLVED
];

export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event);
  const id = getRouterParam(event, "id");
  const body = await readBody<{
    status?: FeedbackStatus;
  }>(event);

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "缺少反馈 ID" });
  }
  if (!body.status || !FEEDBACK_STATUSES.includes(body.status)) {
    throw createError({ statusCode: 400, statusMessage: "反馈状态无效" });
  }

  const feedback = await prisma.feedback.update({
    where: { id },
    data: {
      status: body.status,
      reviewedAt: body.status === FeedbackStatus.NEW ? null : new Date(),
      reviewedById: body.status === FeedbackStatus.NEW ? null : admin.profile.id
    }
  });

  await writeAuditLog({
    actorId: admin.profile.id,
    action: "admin.feedback.updated",
    targetType: "Feedback",
    targetId: feedback.id,
    metadata: { status: feedback.status }
  });

  return { feedback };
});
