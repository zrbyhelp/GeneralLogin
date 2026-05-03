import { requirePortalUser } from "~/server/utils/auth";
import { publicUser } from "~/server/utils/auth-service";
import { updateUserPassword } from "~/server/utils/profile";

export default defineEventHandler(async (event) => {
  const { profile } = await requirePortalUser(event);
  const body = await readBody<{
    currentPassword?: string;
    newPassword?: string;
  }>(event);

  const updated = await updateUserPassword({
    user: profile,
    currentPassword: body.currentPassword,
    newPassword: body.newPassword,
    allowInitialPassword: true
  });

  return { user: publicUser(updated) };
});
