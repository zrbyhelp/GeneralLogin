import { requirePortalUser } from "~/server/utils/auth";
import { publicUser } from "~/server/utils/auth-service";

export default defineEventHandler(async (event) => {
  const { profile } = await requirePortalUser(event);

  return publicUser(profile);
});
