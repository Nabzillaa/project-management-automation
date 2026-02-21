### Build stage ###
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.18.1 --activate

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .npmrc ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY packages/frontend/package.json packages/frontend/tsconfig.json ./packages/frontend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY packages/frontend/ ./packages/frontend/

# VITE_API_URL must be set at build time (Vite inlines env vars)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build shared types then frontend
RUN pnpm --filter @pm-app/shared build
RUN HTTP/3 skipped because it requires TLS
server running
autosaved config (load with --resume flag)
serving initial configuration
cleaning storage unit
finished cleaning storage units
maxprocs: Updating GOMAXPROCS=2: determined from CPU quota
GOMEMLIMIT is updated
using config from file
adapted config to JSON
Caddyfile input is not formatted; run 'caddy fmt --overwrite' to fix inconsistencies
admin endpoint started
started background certificate maintenance
HTTP/2 skipped because it requires TLS
Starting Container

### Production stage ###
FROM caddy:2-alpine

COPY packages/frontend/Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/packages/frontend/dist /usr/share/caddy
