import { createError } from "h3";
import { createSession } from "~/server/utils/auth";
import { loginEmailUser, publicUser } from "~/server/utils/auth-service";

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    email?: string;
    password?: string;
  }>(event);

  const email = body.email?.trim();
  const password = body.password || "";

  if (!email || !password) {
    throw createError({ statusCode: 400, message: "请输入邮箱和密码" });
  }

  const profile = await loginEmailUser({ email, password });
  await createSession(event, profile);

  return { user: publicUser(profile) };
});
