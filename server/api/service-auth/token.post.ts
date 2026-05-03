import { getAppUrl } from "~/server/utils/config";
import { consumeServiceAuthCode } from "~/server/utils/service-auth";

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    clientId?: string;
    clientSecret?: string;
    code?: string;
  }>(event);

  if (!body.clientId || !body.clientSecret || !body.code) {
    throw createError({
      statusCode: 400,
      statusMessage: "clientId、clientSecret、code 为必填"
    });
  }

  const result = await consumeServiceAuthCode({
    clientId: body.clientId,
    clientSecret: body.clientSecret,
    code: body.code
  });

  const relogin = new URL("/relogin", getAppUrl());
  relogin.searchParams.set("client_id", result.service.clientId);
  relogin.searchParams.set("callback", result.callbackUrl);
  if (result.state) {
    relogin.searchParams.set("state", result.state);
  }

  return {
    ok: true,
    user: {
      id: result.user.id,
      account: result.user.account,
      email: result.user.email,
      username: result.user.username,
      name: result.user.name,
      avatarUrl: result.user.avatarUrl,
      status: result.user.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE"
    },
    service: {
      id: result.service.id,
      slug: result.service.slug,
      name: result.service.name
    },
    state: result.state,
    reloginUrl: relogin.toString()
  };
});
