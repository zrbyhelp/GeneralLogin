import { type UserProfile } from "@prisma/client";
import { createError } from "h3";
import { tryNormalizeUrl } from "~/server/utils/crypto";
import { hashPassword, validatePassword, verifyPassword } from "~/server/utils/password";
import { prisma } from "~/server/utils/prisma";

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function cleanNullableText(value: unknown, maxLength: number, label: string) {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();
  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw createError({
      statusCode: 400,
      statusMessage: `${label}不能超过 ${maxLength} 个字符`
    });
  }

  return text;
}

export function buildProfileUpdateData(input: Record<string, unknown>) {
  const data: {
    name?: string | null;
    avatarUrl?: string | null;
  } = {};

  if (hasOwn(input, "name")) {
    data.name = cleanNullableText(input.name, 80, "名称");
  }

  if (hasOwn(input, "username")) {
    throw createError({ statusCode: 400, statusMessage: "用户名不支持修改" });
  }

  if (hasOwn(input, "avatarUrl")) {
    const avatarUrl = cleanNullableText(input.avatarUrl, 2048, "头像地址");
    if (avatarUrl && !tryNormalizeUrl(avatarUrl)) {
      throw createError({ statusCode: 400, statusMessage: "头像地址格式无效" });
    }
    data.avatarUrl = avatarUrl;
  }

  if (!Object.keys(data).length) {
    throw createError({ statusCode: 400, statusMessage: "没有可更新的资料" });
  }

  return data;
}

export async function updateUserProfile(userId: string, input: Record<string, unknown>) {
  return prisma.userProfile.update({
    where: { id: userId },
    data: buildProfileUpdateData(input)
  });
}

export async function updateUserPassword(params: {
  user: UserProfile;
  currentPassword?: string | null;
  newPassword?: string | null;
  allowInitialPassword: boolean;
}) {
  const newPassword = params.newPassword || "";
  if (!newPassword) {
    throw createError({ statusCode: 400, statusMessage: "请输入新密码" });
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    throw createError({ statusCode: 400, statusMessage: passwordError });
  }

  if (params.user.passwordHash) {
    if (!params.currentPassword) {
      throw createError({ statusCode: 400, statusMessage: "请输入当前密码" });
    }

    const valid = await verifyPassword(params.currentPassword, params.user.passwordHash);
    if (!valid) {
      throw createError({ statusCode: 403, statusMessage: "当前密码错误" });
    }
  } else if (!params.allowInitialPassword) {
    throw createError({
      statusCode: 403,
      statusMessage: "该用户尚未设置门户密码，请先在门户个人资料中设置"
    });
  }

  return prisma.userProfile.update({
    where: { id: params.user.id },
    data: {
      passwordHash: await hashPassword(newPassword)
    }
  });
}
