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
RUN npx prisma generate
RUN pnpm build

# ---- Stage 3: Runtime ----
FROM node:20-slim AS runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=build /app/packages/bff/dist ./dist
COPY --from=build /app/packages/bff/node_modules ./node_modules
COPY --from=build /app/node_modules/.pnpm node_modules/.pnpm
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/node_modules/@prisma node_modules/@prisma
COPY --from=build /app/packages/bff/package.json ./

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/main"]
