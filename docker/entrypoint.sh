#!/bin/sh
set -eu

if [ "${DB_PUSH_ON_START:-true}" = "true" ]; then
  pnpm exec prisma db push --accept-data-loss --skip-generate
fi

if [ "${DB_BACKFILL_ACCOUNTS_ON_START:-true}" = "true" ]; then
  node scripts/backfill-accounts.mjs
fi

exec "$@"
