import { requirePortalUser } from "~/server/utils/auth";
import { publicUser } from "~/server/utils/auth-service";
import { updateUserProfile } from "~/server/utils/profile";

export default defineEventHandler(async (event) => {
  const { profile } = await requirePortalUser(event);
  const body = await readBody<Record<string, unknown>>(event);
  const updated = await updateUserProfile(profile.id, body);

  return { user: publicUser(updated) };
});
