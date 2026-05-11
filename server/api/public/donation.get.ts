import {
  DONATION_SETTING_ID,
  publicDonationSettingToDto
} from "~/server/utils/donation";
import { prisma } from "~/server/utils/prisma";

export default defineEventHandler(async () => {
  const donation = await prisma.donationSetting.findUnique({
    where: { id: DONATION_SETTING_ID }
  });

  return {
    donation: publicDonationSettingToDto(donation)
  };
});
