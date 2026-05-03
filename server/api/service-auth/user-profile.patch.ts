import { createError } from "h3";
import { requireServiceAccessibleUser } from "~/server/utils/service-auth";
import { publicUser } from "~/server/utils/auth-service";
import { updateUserPassword, updateUserProfile } from "~/server/utils/profile";

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    clientId?: string;
    clientSecret?: string;
    userId?: string;
    name?: string;
    avatarUrl?: string;
    currentPassword?: string;
    newPassword?: string;
  }>(event);

  if (!body.clientId || !body.clientSecret || !body.userId) {
    throw createError({
      statusCode: 400,
      statusMessage: "clientId、clientSecret、userId 为必填"
    });
  }

  const { user, service } = await requireServiceAccessibleUser({
    clientId: body.clientId,
    clientSecret: body.clientSecret,
    userId: body.userId
  });

  const profileInput: Record<string, unknown> = {};
  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    profileInput.name = body.name;
  }
  if (Object.prototype.hasOwnProperty.call(body, "avatarUrl")) {
    profileInput.avatarUrl = body.avatarUrl;
  }

  let updatedUser = user;
  if (Object.keys(profileInput).length) {
    updatedUser = await updateUserProfile(user.id, profileInput);
  }

  if (Object.prototype.hasOwnProperty.call(body, "newPassword")) {
    updatedUser = await updateUserPassword({
      user: updatedUser,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      allowInitialPassword: false
    });
  }

  return {
    ok: true,
    service: {
      id: service.id,
      slug: service.slug,
      name: service.name
    },
    user: publicUser(updatedUser)
  };
});
