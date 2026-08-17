import { createError } from "h3";
import { publicUser, registerAccountUser } from "~/server/utils/auth-service";
import { canUseService, requireServiceClient } from "~/server/utils/service-auth";

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    clientId?: string;
    clientSecret?: string;
    account?: string;
    password?: string;
    name?: string;
    agreementAccepted?: boolean;
  }>(event);

  if (!body.clientId || !body.clientSecret) {
    throw createError({ statusCode: 400, statusMessage: "clientId、clientSecret 为必填" });
  }
  if (body.agreementAccepted !== true) {
    throw createError({ statusCode: 400, statusMessage: "请先阅读并同意隐私权和服务条款" });
  }

  const account = body.account?.trim();
  const password = body.password || "";
  if (!account || !password) {
    throw createError({ statusCode: 400, statusMessage: "请输入账号和密码" });
  }

  const service = await requireServiceClient({
    clientId: body.clientId,
    clientSecret: body.clientSecret
  });
  const profile = await registerAccountUser({
    account,
    password,
    name: body.name
  });
  await canUseService(profile, service);

  return {
    ok: true,
    user: publicUser(profile),
    service: { id: service.id, slug: service.slug, name: service.name }
  };
});
