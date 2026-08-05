import { Prisma } from "@prisma/client";
import { getQuery } from "h3";
import { requireAdminUser } from "~/server/utils/auth";
import { prisma } from "~/server/utils/prisma";

const ALLOWED_DAY_RANGES = [7, 30, 90] as const;
const DEFAULT_DAY_RANGE = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_UTC_OFFSET_MINUTES = -12 * 60;
const MAX_UTC_OFFSET_MINUTES = 14 * 60;

type DayRange = (typeof ALLOWED_DAY_RANGES)[number];

type DailyUserCount = {
  date: string;
  count: bigint | number;
};

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseDayRange(value: string | string[] | undefined): DayRange {
  const parsed = Number(firstQueryValue(value));
  return ALLOWED_DAY_RANGES.includes(parsed as DayRange)
    ? parsed as DayRange
    : DEFAULT_DAY_RANGE;
}

function parseUtcOffset(value: string | string[] | undefined) {
  const parsed = Number(firstQueryValue(value));
  if (!Number.isInteger(parsed)) {
    return -new Date().getTimezoneOffset();
  }

  return Math.min(MAX_UTC_OFFSET_MINUTES, Math.max(MIN_UTC_OFFSET_MINUTES, parsed));
}

function dateKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export default defineEventHandler(async (event) => {
  await requireAdminUser(event);

  const query = getQuery(event) as Record<string, string | string[]>;
  const days = parseDayRange(query.days);
  const utcOffsetMinutes = parseUtcOffset(query.utcOffsetMinutes);
  const offsetMs = utcOffsetMinutes * 60 * 1000;
  const nowInRequestedZone = new Date(Date.now() + offsetMs);
  const currentLocalDayStart = Date.UTC(
    nowInRequestedZone.getUTCFullYear(),
    nowInRequestedZone.getUTCMonth(),
    nowInRequestedZone.getUTCDate()
  );
  const rangeStartLocal = currentLocalDayStart - (days - 1) * DAY_MS;
  const rangeEndLocal = currentLocalDayStart + DAY_MS;
  const rangeStart = new Date(rangeStartLocal - offsetMs);
  const rangeEnd = new Date(rangeEndLocal - offsetMs);

  const [usersBeforeRange, dailyRows] = await prisma.$transaction([
    prisma.userProfile.count({
      where: { createdAt: { lt: rangeStart } }
    }),
    prisma.$queryRaw<DailyUserCount[]>(Prisma.sql`
      SELECT
        DATE_FORMAT(TIMESTAMPADD(MINUTE, ${utcOffsetMinutes}, createdAt), '%Y-%m-%d') AS date,
        COUNT(*) AS count
      FROM UserProfile
      WHERE createdAt >= ${rangeStart} AND createdAt < ${rangeEnd}
      GROUP BY date
      ORDER BY date ASC
    `)
  ]);

  const countsByDate = new Map(
    dailyRows.map((row) => [String(row.date), Number(row.count)])
  );
  let totalUsers = usersBeforeRange;
  let addedUsers = 0;
  const points = Array.from({ length: days }, (_, index) => {
    const date = dateKey(rangeStartLocal + index * DAY_MS);
    const newUsers = countsByDate.get(date) || 0;
    addedUsers += newUsers;
    totalUsers += newUsers;

    return {
      date,
      newUsers,
      totalUsers
    };
  });

  return {
    days,
    utcOffsetMinutes,
    addedUsers,
    points
  };
});
