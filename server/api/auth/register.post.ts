import { createError } from "h3";
import { createSession } from "~/server/utils/auth";
import {
  publicUser,
  registerAccountUser
} from "~/server/utils/auth-service";

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    account?: string;
    password?: string;
    name?: string;
  }>(event);

  const account = body.account?.trim();
  const password = body.password || "";

  if (!account || !password) {
    throw createError({ statusCode: 400, message: "请输入账号和密码" });
  }

  const profile = await registerAccountUser({
    account,
    password,
    name: body.name
  });
  await createSession(event, profile);

  return {
    user: publicUser(profile),
    next: "/apps"
  };
});
