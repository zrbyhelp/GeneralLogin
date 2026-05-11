import type { Prisma } from "@prisma/client";
import { createError } from "h3";
import { requireAdminUser } from "~/server/utils/auth";
import {
  DONATION_SETTING_ID,
  donationSettingToDto,
  normalizeDonationDescription,
  normalizeDonationImageUrls,
  normalizeDonationTitle
} from "~/server/utils/donation";
import { prisma } from "~/server/utils/prisma";
import { writeAuditLog } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event);
  const body = await readBody<{
    title?: string;
    description?: string;
    imageUrls?: unknown;
    enabled?: boolean;
  }>(event);

  const title = normalizeDonationTitle(body.title);
  const description = normalizeDonationDescription(body.description);
  const imageUrls = normalizeDonationImageUrls(body.imageUrls, true);
  const enabled = body.enabled === true;

  if (enabled && (!description || !imageUrls.length)) {
    throw createError({
      statusCode: 400,
      statusMessage: "启用捐赠时说明和图片为必填"
    });
  }

  const donation = await prisma.donationSetting.upsert({
    where: { id: DONATION_SETTING_ID },
    create: {
      id: DONATION_SETTING_ID,
      title,
      description,
      imageUrls: imageUrls as Prisma.InputJsonValue,
      enabled
    },
    update: {
      title,
      description,
      imageUrls: imageUrls as Prisma.InputJsonValue,
      enabled
    }
  });

  await writeAuditLog({
    actorId: admin.profile.id,
    action: "admin.donation.updated",
    targetType: "DonationSetting",
    targetId: donation.id,
    metadata: {
      enabled: donation.enabled,
      imageCount: imageUrls.length
    }
  });

  return {
    donation: donationSettingToDto(donation)
  };
});
