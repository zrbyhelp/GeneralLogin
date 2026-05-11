import { requireAdminUser } from "~/server/utils/auth";
import {
  DONATION_SETTING_ID,
  donationSettingToDto
} from "~/server/utils/donation";
import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);

  const donation = await prisma.donationSetting.findUnique({
    where: { id: DONATION_SETTING_ID }
  });

  return {
    donation: donationSettingToDto(donation)
  };
});
