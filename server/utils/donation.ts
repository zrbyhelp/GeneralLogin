import type { DonationSetting } from "@prisma/client";
import { createError } from "h3";
import { tryNormalizeUrl } from "~/server/utils/crypto";

export const DONATION_SETTING_ID = "global";
export const DEFAULT_DONATION_TITLE = "捐赠支持";
export const MAX_DONATION_IMAGES = 12;
export const MAX_DONATION_TITLE_LENGTH = 80;
export const MAX_DONATION_DESCRIPTION_LENGTH = 2000;

export type DonationDto = {
  id: string;
  title: string;
  description: string;
  imageUrls: string[];
  enabled: boolean;
  updatedAt: string | null;
};

export function normalizeDonationImageUrls(value: unknown, strict = false) {
  const items = Array.isArray(value) ? value : [];
  if (items.length > MAX_DONATION_IMAGES) {
    throw createError({
      statusCode: 400,
      statusMessage: `捐赠图片最多 ${MAX_DONATION_IMAGES} 张`
    });
  }

  const urls: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (typeof item !== "string") {
      continue;
    }

    const url = item.trim();
    if (!url) {
      continue;
    }

    if (!tryNormalizeUrl(url)) {
      if (strict) {
        throw createError({ statusCode: 400, statusMessage: "捐赠图片地址格式无效" });
      }
      continue;
    }

    if (!seen.has(url)) {
      urls.push(url);
      seen.add(url);
    }
  }

  return urls;
}

export function normalizeDonationTitle(value: unknown) {
  const title = typeof value === "string" ? value.trim() : "";
  if (title.length > MAX_DONATION_TITLE_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `捐赠标题不能超过 ${MAX_DONATION_TITLE_LENGTH} 字`
    });
  }

  return title || DEFAULT_DONATION_TITLE;
}

export function normalizeDonationDescription(value: unknown) {
  const description = typeof value === "string" ? value.trim() : "";
  if (description.length > MAX_DONATION_DESCRIPTION_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `捐赠说明不能超过 ${MAX_DONATION_DESCRIPTION_LENGTH} 字`
    });
  }

  return description;
}

export function donationSettingToDto(setting: DonationSetting | null): DonationDto {
  return {
    id: setting?.id || DONATION_SETTING_ID,
    title: setting?.title || DEFAULT_DONATION_TITLE,
    description: setting?.description || "",
    imageUrls: normalizeDonationImageUrls(setting?.imageUrls),
    enabled: setting?.enabled || false,
    updatedAt: setting?.updatedAt ? setting.updatedAt.toISOString() : null
  };
}

export function publicDonationSettingToDto(setting: DonationSetting | null) {
  const donation = donationSettingToDto(setting);

  if (!donation.enabled || !donation.description || !donation.imageUrls.length) {
    return null;
  }

  return {
    title: donation.title,
    description: donation.description,
    imageUrls: donation.imageUrls
  };
}
