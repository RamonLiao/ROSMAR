# ---- Stage 1: Install + Build ----
FROM node:20-slim AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/frontend/package.json packages/frontend/
RUN pnpm install --frozen-lockfile --filter frontend...

COPY packages/frontend packages/frontend
WORKDIR /app/packages/frontend
RUN pnpm build

# ---- Stage 2: Runtime ----
FROM node:20-slim AS runtime
WORKDIR /app

COPY --from=build /app/packages/frontend/.next/standalone ./
COPY --from=build /app/packages/frontend/.next/static .next/static
COPY --from=build /app/packages/frontend/public public

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["node", "server.js"]
