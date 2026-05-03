import { UserStatus, type UserProfile } from "@prisma/client";
import { createError } from "h3";
import { getAdminEmails, getLinuxdoConfig } from "~/server/utils/config";
import { normalizeEmail } from "~/server/utils/crypto";
import { hashPassword, validatePassword, verifyPassword } from "~/server/utils/password";
import { prisma } from "~/server/utils/prisma";

export function publicUser(profile: UserProfile) {
  return {
    id: profile.id,
    email: profile.email,
    username: profile.username,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    status: profile.status,
    isAdmin: profile.isAdminSnapshot
  };
}

export function isAdminEmail(email?: string | null) {
  return !!email && getAdminEmails().includes(normalizeEmail(email));
}

export async function syncAdminSnapshot(profile: UserProfile) {
  const nextIsAdmin = isAdminEmail(profile.email);

  if (
    profile.isAdminSnapshot === nextIsAdmin &&
    (!nextIsAdmin || profile.status === UserStatus.APPROVED)
  ) {
    return profile;
  }

  return prisma.userProfile.update({
    where: { id: profile.id },
    data: {
      isAdminSnapshot: nextIsAdmin,
      status:
        profile.status === UserStatus.SUSPENDED
          ? profile.status
          : nextIsAdmin
            ? UserStatus.APPROVED
            : profile.status,
      approvedAt: nextIsAdmin && !profile.approvedAt ? new Date() : profile.approvedAt
    }
  });
}

export async function registerEmailUser(params: {
  email: string;
  password: string;
  name?: string;
  username?: string;
}) {
  const email = normalizeEmail(params.email);
  if (!email.includes("@")) {
    throw createError({ statusCode: 400, message: "邮箱格式无效" });
  }

  const passwordError = validatePassword(params.password);
  if (passwordError) {
    throw createError({ statusCode: 400, message: passwordError });
  }

  const exists = await prisma.userProfile.findUnique({ where: { email } });
  if (exists && exists.passwordHash) {
    throw createError({ statusCode: 409, message: "该邮箱已注册" });
  }
  if (exists?.status === UserStatus.SUSPENDED) {
    throw createError({ statusCode: 403, message: "账号已停用" });
  }

  const passwordHash = await hashPassword(params.password);
  const isAdmin = isAdminEmail(email);

  if (exists) {
    return prisma.userProfile.update({
      where: { id: exists.id },
      data: {
        name: params.name?.trim() || exists.name,
        username: params.username?.trim() || exists.username,
        passwordHash,
        status:
          exists.status === UserStatus.SUSPENDED
            ? exists.status
            : isAdmin
              ? UserStatus.APPROVED
              : exists.status,
        isAdminSnapshot: isAdmin,
        approvedAt: isAdmin ? new Date() : exists.approvedAt,
        lastLoginAt: new Date()
      }
    });
  }

  return prisma.userProfile.create({
    data: {
      email,
      name: params.name?.trim() || null,
      username: params.username?.trim() || null,
      passwordHash,
      status: isAdmin ? UserStatus.APPROVED : UserStatus.PENDING,
      isAdminSnapshot: isAdmin,
      approvedAt: isAdmin ? new Date() : null,
      lastLoginAt: new Date()
    }
  });
}

export async function loginEmailUser(params: { email: string; password: string }) {
  const email = normalizeEmail(params.email);
  const user = await prisma.userProfile.findUnique({ where: { email } });

  if (!user || !user.passwordHash) {
    throw createError({ statusCode: 401, message: "邮箱或密码错误" });
  }

  if (!(await verifyPassword(params.password, user.passwordHash))) {
    throw createError({ statusCode: 401, message: "邮箱或密码错误" });
  }

  const profile = await syncAdminSnapshot(user);
  await ensureUserCanLogin(profile);
  await prisma.userProfile.update({
    where: { id: profile.id },
    data: { lastLoginAt: new Date() }
  });

  return prisma.userProfile.findUniqueOrThrow({ where: { id: profile.id } });
}

export async function findOrCreateLinuxdoUser(params: {
  linuxdoUserId: string;
  username?: string;
  name?: string;
  avatarUrl?: string;
  profile?: unknown;
}) {
  const existingAccount = await prisma.authAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "linuxdo",
        providerAccountId: params.linuxdoUserId
      }
    },
    include: { user: true }
  });

  if (existingAccount) {
    await ensureUserCanLogin(existingAccount.user);
    const updatedUser = await prisma.userProfile.update({
      where: { id: existingAccount.userId },
      data: {
        username: params.username?.trim() || existingAccount.user.username,
        name: params.name?.trim() || existingAccount.user.name,
        avatarUrl: params.avatarUrl || existingAccount.user.avatarUrl,
        lastLoginAt: new Date()
      }
    });

    await prisma.authAccount.update({
      where: { id: existingAccount.id },
      data: {
        username: params.username?.trim() || existingAccount.username,
        profile: params.profile as never
      }
    });

    return syncAdminSnapshot(updatedUser);
  }

  const profile = await prisma.userProfile.create({
    data: {
      email: null,
      username: params.username?.trim() || null,
      name: params.name?.trim() || params.username?.trim() || null,
      avatarUrl: params.avatarUrl || null,
      status: UserStatus.PENDING,
      isAdminSnapshot: false,
      lastLoginAt: new Date()
    }
  });

  await ensureUserCanLogin(profile);
  await prisma.authAccount.create({
    data: {
      userId: profile.id,
      provider: "linuxdo",
      providerAccountId: params.linuxdoUserId,
      username: params.username?.trim() || null,
      profile: params.profile as never
    }
  });

  return profile;
}

export function getLinuxdoAuthorizeUrl(state: string, loginHint?: string) {
  const config = getLinuxdoConfig();
  if (!config.clientId || !config.clientSecret) {
    throw createError({
      statusCode: 500,
      message: "未配置 Linux.do OAuth"
    });
  }

  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  if (config.scope) {
    url.searchParams.set("scope", config.scope);
  }
  url.searchParams.set("state", state);
  if (loginHint) {
    url.searchParams.set("login_hint", loginHint);
  }
  return url.toString();
}

export async function exchangeLinuxdoCode(code: string) {
  const config = getLinuxdoConfig();
  if (!config.clientId || !config.clientSecret) {
    throw createError({
      statusCode: 500,
      message: "未配置 Linux.do OAuth"
    });
  }

  const tokenResponse = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${config.clientId}:${config.clientSecret}`
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri
    })
  });

  if (!tokenResponse.ok) {
    throw createError({
      statusCode: 401,
      message: "Linux.do 登录失败"
    });
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
  };

  if (!tokenData.access_token) {
    throw createError({
      statusCode: 401,
      message: "Linux.do 登录失败"
    });
  }

  const userResponse = await fetch(config.userUrl, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/json"
    }
  });

  if (!userResponse.ok) {
    throw createError({
      statusCode: 401,
      message: "Linux.do 用户信息获取失败"
    });
  }

  const user = (await userResponse.json()) as {
    id: number | string;
    username?: string;
    name?: string;
    avatar_template?: string;
    avatar_url?: string;
    avatarUrl?: string;
  };

  const avatarUrl =
    user.avatar_url ||
    user.avatarUrl ||
    (user.avatar_template
      ? user.avatar_template.replace("{size}", "96")
      : null);

  return {
    id: String(user.id),
    username: user.username || null,
    name: user.name || user.username || null,
    avatarUrl,
    profile: user
  };
}

export function buildExternalLoginState(value: {
  oauthState?: string;
  clientId?: string;
  callbackUrl?: string;
  state?: string;
}) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function parseExternalLoginState(value: string) {
  try {
    const raw = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as {
      oauthState?: string;
      clientId?: string;
      callbackUrl?: string;
      state?: string;
    };
    return parsed;
  } catch {
    return {};
  }
}

export async function ensureUserCanLogin(profile: UserProfile) {
  if (profile.status === UserStatus.SUSPENDED) {
    throw createError({ statusCode: 403, message: "账号已停用" });
  }
}
