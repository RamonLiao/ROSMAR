# ---- Stage 1: Install + Build ----
FROM node:20-slim AS build
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/frontend/package.json packages/frontend/
RUN pnpm install --frozen-lockfile --filter frontend...

COPY packages/frontend packages/frontend
WORKDIR /app/packages/frontend

# Next.js inlines NEXT_PUBLIC_* at build time
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_ENOKI_API_KEY
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_ENOKI_API_KEY=$NEXT_PUBLIC_ENOKI_API_KEY

RUN pnpm build

# ---- Stage 2: Runtime ----
FROM node:20-slim AS runtime
WORKDIR /app

COPY --from=build /app/packages/frontend/.next/standalone ./
COPY --from=build /app/packages/frontend/.next/static ./packages/frontend/.next/static
COPY --from=build /app/packages/frontend/public ./packages/frontend/public

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["node", "packages/frontend/server.js"]
