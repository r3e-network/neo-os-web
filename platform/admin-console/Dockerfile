# =============================================================================
# Admin Console Dockerfile
# Multi-stage build for Next.js standalone deployment
# Build context: monorepo root (docker build -f platform/admin-console/Dockerfile .)
# =============================================================================

FROM node:20-alpine AS base
RUN corepack enable

# --- deps stage: install dependencies ---
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY platform/admin-console/package.json ./platform/admin-console/
COPY packages/ ./packages/

RUN pnpm install --frozen-lockfile

# --- builder stage: build the Next.js app ---
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/ ./
COPY platform/admin-console/ ./platform/admin-console/

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN pnpm --filter admin-console build

# --- runner stage: minimal production image ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/platform/admin-console/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/platform/admin-console/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/platform/admin-console/.next/static ./.next/static

USER nextjs

EXPOSE 3002
ENV PORT=3002
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
