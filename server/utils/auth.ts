import { UserStatus, type UserProfile } from "@prisma/client";
import {
  createError,
  deleteCookie,
  getCookie,
  getRequestHeader,
  getRequestIP,
  setCookie,
  type H3Event
} from "h3";
import { getAdminAccounts, getAdminEmails } from "~/server/utils/config";
import { generateToken, sha256 } from "~/server/utils/crypto";
import { isAdminEmail, syncAdminSnapshot } from "~/server/utils/auth-service";
import { prisma } from "~/server/utils/prisma";

export const SESSION_COOKIE = "zr_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export async function createSession(event: H3Event, profile: UserProfile) {
  const token = generateToken(32);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  const userAgent = getRequestHeader(event, "user-agent") || null;
  const ipAddress = getRequestIP(event, { xForwardedFor: true }) || null;

  await prisma.authSession.create({
    data: {
      tokenHash: sha256(token),
      userId: profile.id,
      expiresAt,
      userAgent,
      ipAddress
    }
  });

  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE
  });
}

export async function clearAuthSession(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE);

  if (token) {
    await prisma.authSession.deleteMany({
      where: { tokenHash: sha256(token) }
    });
  }

  deleteCookie(event, SESSION_COOKIE, { path: "/" });
}

export async function getPortalUser(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE);
  if (!token) {
    return null;
  }

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true }
  });

  if (!session || session.expiresAt.getTime() < Date.now()) {
    await clearAuthSession(event);
    return null;
  }

  await prisma.authSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() }
  });

  const profile = await syncAdminSnapshot(session.user);
  return { session, profile };
}

export async function requirePortalUser(event: H3Event) {
  const user = await getPortalUser(event);

  if (!user) {
    throw createError({ statusCode: 401, message: "未登录" });
  }

  return user;
}

export async function requireAdminUser(event: H3Event) {
  const session = await requirePortalUser(event);
  const adminEmails = getAdminEmails();
  const adminAccounts = getAdminAccounts();

  if (!adminEmails.length && !adminAccounts.length) {
    throw createError({
      statusCode: 500,
      message: "未配置管理员账号"
    });
  }

  if (
    !session.profile.isAdminSnapshot &&
    !adminAccounts.includes((session.profile.account || "").toLowerCase()) &&
    !isAdminEmail(session.profile.email)
  ) {
    throw createError({ statusCode: 403, message: "无管理员权限" });
  }

  await ensureActiveUser(session.profile);
  return session;
}

export async function ensureActiveUser(profile: UserProfile) {
  if (profile.status === UserStatus.SUSPENDED) {
    throw createError({ statusCode: 403, message: "账号已停用" });
  }
}
