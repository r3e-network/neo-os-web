# =============================================================================
# Host App Dockerfile
# Multi-stage build for Next.js standalone deployment
# Build context: monorepo root (docker build -f platform/host-app/Dockerfile .)
# =============================================================================

FROM node:20-alpine AS base
RUN corepack enable

# --- deps stage: install production + dev dependencies ---
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY platform/host-app/package.json ./platform/host-app/
COPY packages/ ./packages/
COPY miniapps/shared/package.json ./miniapps/shared/

RUN pnpm install --frozen-lockfile

# --- builder stage: build the Next.js app ---
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/ ./
COPY platform/host-app/ ./platform/host-app/
COPY miniapps/shared/ ./miniapps/shared/

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN pnpm --filter meshminiapp-host build

# --- runner stage: minimal production image ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/platform/host-app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/platform/host-app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/platform/host-app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
