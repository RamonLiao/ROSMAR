#!/usr/bin/env bash
set -euo pipefail

echo "==> Backing up database..."
pg_dump "$DATABASE_URL" > "backup_$(date +%Y%m%d_%H%M%S).sql"

echo "==> Running Prisma migrations..."
cd packages/bff && npx prisma migrate deploy

echo "==> Regenerating Prisma client..."
npx prisma generate

echo "==> Migration complete."
