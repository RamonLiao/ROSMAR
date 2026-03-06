# ---- Stage 1: Install dependencies ----
FROM node:20-slim AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/bff/package.json packages/bff/
RUN pnpm install --frozen-lockfile --filter bff...

# ---- Stage 2: Build ----
FROM node:20-slim AS build
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/bff/node_modules ./packages/bff/node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/bff packages/bff

WORKDIR /app/packages/bff
COPY packages/bff/prisma.config.ts ./prisma.config.ts
COPY packages/bff/prisma ./prisma
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate
RUN pnpm build

# ---- Stage 3: Runtime ----
FROM node:20-slim AS runtime
WORKDIR /app

# Copy hoisted root node_modules + bff-specific node_modules
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/bff/node_modules ./packages/bff/node_modules
COPY --from=build /app/packages/bff/dist ./packages/bff/dist
COPY --from=build /app/packages/bff/package.json ./packages/bff/package.json
COPY --from=build /app/packages/bff/prisma.config.ts ./packages/bff/prisma.config.ts
COPY --from=build /app/packages/bff/prisma ./packages/bff/prisma

ENV NODE_ENV=production
WORKDIR /app/packages/bff
EXPOSE 3001

CMD ["node", "dist/src/main"]
