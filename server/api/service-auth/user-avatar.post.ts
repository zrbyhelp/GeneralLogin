import { createError, readMultipartFormData } from "h3";
import { publicUser } from "~/server/utils/auth-service";
import { updateUserProfile } from "~/server/utils/profile";
import { requireServiceAccessibleUser } from "~/server/utils/service-auth";
import {
  getTextFromParts,
  getUploadedFileFromParts,
  uploadUserAvatarFile
} from "~/server/utils/storage";

export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event);
  if (!parts?.length) {
    throw createError({ statusCode: 400, statusMessage: "请选择要上传的图片" });
  }

  const clientId = getTextFromParts(parts, "clientId");
  const clientSecret = getTextFromParts(parts, "clientSecret");
  const userId = getTextFromParts(parts, "userId");

  if (!clientId || !clientSecret || !userId) {
    throw createError({
      statusCode: 400,
      statusMessage: "clientId、clientSecret、userId 为必填"
    });
  }

  const { service, user } = await requireServiceAccessibleUser({
    clientId,
    clientSecret,
    userId
  });
  const file = getUploadedFileFromParts(parts);
  const uploaded = await uploadUserAvatarFile({
    userId: user.id,
    file
  });
  const updated = await updateUserProfile(user.id, {
    avatarUrl: uploaded.url
  });

  return {
    ok: true,
    service: {
      id: service.id,
      slug: service.slug,
      name: service.name
    },
    user: publicUser(updated),
    file: uploaded
  };
});
