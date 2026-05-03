import { createError, readMultipartFormData } from "h3";
import { requirePortalUser } from "~/server/utils/auth";
import { publicUser } from "~/server/utils/auth-service";
import { updateUserProfile } from "~/server/utils/profile";
import {
  getUploadedFileFromParts,
  uploadUserAvatarFile
} from "~/server/utils/storage";

export default defineEventHandler(async (event) => {
  const { profile } = await requirePortalUser(event);
  const parts = await readMultipartFormData(event);
  if (!parts?.length) {
    throw createError({ statusCode: 400, statusMessage: "请选择要上传的图片" });
  }

  const file = getUploadedFileFromParts(parts);
  const uploaded = await uploadUserAvatarFile({
    userId: profile.id,
    file
  });
  const updated = await updateUserProfile(profile.id, {
    avatarUrl: uploaded.url
  });

  return {
    user: publicUser(updated),
    file: uploaded
  };
});
