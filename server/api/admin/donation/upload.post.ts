import { createError, readMultipartFormData } from "h3";
import { requireAdminUser } from "~/server/utils/auth";
import {
  getUploadedFileFromParts,
  uploadDonationImageFile
} from "~/server/utils/storage";

export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event);
  const parts = await readMultipartFormData(event);
  if (!parts?.length) {
    throw createError({ statusCode: 400, statusMessage: "请选择要上传的图片" });
  }

  const uploaded = await uploadDonationImageFile({
    adminId: admin.profile.id,
    file: getUploadedFileFromParts(parts)
  });

  return {
    file: uploaded
  };
});
