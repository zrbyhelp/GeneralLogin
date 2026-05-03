import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeAccount(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/@.*$/, "")
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^[_.-]+|[_.-]+$/g, "")
    .slice(0, 32);

  return normalized.length >= 3 ? normalized : "";
}

function fallbackAccount(user) {
  return normalizeAccount(user.email || user.username || user.name || `user-${user.id.slice(-8)}`);
}

async function uniqueAccount(base, userId) {
  const root = base || `user-${randomBytes(3).toString("hex")}`;
  let candidate = root.slice(0, 32);

  for (let index = 0; index < 20; index += 1) {
    const existing = await prisma.userProfile.findUnique({
      where: { account: candidate }
    });

    if (!existing || existing.id === userId) {
      return candidate;
    }

    const suffix = `-${randomBytes(2).toString("hex")}`;
    candidate = `${root.slice(0, 32 - suffix.length)}${suffix}`;
  }

  return `user-${randomBytes(8).toString("hex")}`.slice(0, 32);
}

async function main() {
  const users = await prisma.userProfile.findMany({
    where: { account: null },
    select: {
      id: true,
      email: true,
      username: true,
      name: true
    }
  });

  for (const user of users) {
    const account = await uniqueAccount(fallbackAccount(user), user.id);
    await prisma.userProfile.update({
      where: { id: user.id },
      data: { account }
    });
    console.log(`Backfilled ${user.id} -> ${account}`);
  }

  console.log(`Backfilled ${users.length} user account(s).`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
