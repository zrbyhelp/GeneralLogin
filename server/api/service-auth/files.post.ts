import { createError, readMultipartFormData } from "h3";
import {
  requireServiceAccessibleUser,
  requireServiceClient
} from "~/server/utils/service-auth";
import {
  getTextFromParts,
  getUploadedFileFromParts,
  uploadServiceFile
} from "~/server/utils/storage";

export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event);
  if (!parts?.length) {
    throw createError({ statusCode: 400, statusMessage: "请选择要上传的文件" });
  }

  const clientId = getTextFromParts(parts, "clientId");
  const clientSecret = getTextFromParts(parts, "clientSecret");
  const userId = getTextFromParts(parts, "userId");
  const purpose = getTextFromParts(parts, "purpose") || "files";

  if (!clientId || !clientSecret) {
    throw createError({
      statusCode: 400,
      statusMessage: "clientId、clientSecret 为必填"
    });
  }

  const { service, user } = userId
    ? await requireServiceAccessibleUser({ clientId, clientSecret, userId })
    : { service: await requireServiceClient({ clientId, clientSecret }), user: null };

  const file = getUploadedFileFromParts(parts);
  const uploaded = await uploadServiceFile({
    serviceId: service.id,
    userId: user?.id || null,
    purpose,
    file
  });

  return {
    ok: true,
    service: {
      id: service.id,
      slug: service.slug,
      name: service.name
    },
    userId: user?.id || null,
    file: uploaded
  };
});
