import { createError } from "h3";
import { createSession } from "~/server/utils/auth";
import { loginAccountUser, publicUser } from "~/server/utils/auth-service";

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    account?: string;
    password?: string;
  }>(event);

  const account = body.account?.trim();
  const password = body.password || "";

  if (!account || !password) {
    throw createError({ statusCode: 400, message: "请输入账号和密码" });
  }

  const profile = await loginAccountUser({ account, password });
  await createSession(event, profile);

  return { user: publicUser(profile) };
});
