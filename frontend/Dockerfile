# Web image: Next.js standalone server (adapted from the official examples/with-docker).
# Build: docker build -t mba-web frontend/
# Run:   docker compose -f infra/docker-compose.yml up (needs the api service)
ARG NODE_VERSION=24.22.0-slim

# 1. Dependencies: this layer stays cached while only the code changes
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# 2. Build: next build writes .next/standalone (server.js + needed modules) and .next/static
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 3. Runtime: only the standalone output, run by the non-root "node" user
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    API_URL=http://api:8000

# Writable folder for the Next.js cache; the code itself is copied for "node"
RUN mkdir .next && chown node:node .next
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000
CMD ["node", "server.js"]
