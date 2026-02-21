### Builder stage ###
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.18.1 --activate

WORKDIR /app

# Copy workspace config files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .npmrc ./

# Copy all package manifests for dependency installation
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY packages/planning-engine/package.json packages/planning-engine/tsconfig.json ./packages/planning-engine/
COPY packages/database/package.json packages/database/tsconfig.json ./packages/database/
COPY packages/backend/package.json packages/backend/tsconfig.json ./packages/backend/

# Install all dependencies (no frozen-lockfile to ensure workspace links are set up correctly)
RUN pnpm install --no-frozen-lockfile

# Copy all source code
COPY packages/shared/ ./packages/shared/
COPY packages/planning-engine/ ./packages/planning-engine/
COPY packages/database/ ./packages/database/
COPY packages/backend/ ./packages/backend/

# Build in dependency order
RUN pnpm --filter @pm-app/shared build
RUN pnpm --filter @pm-app/planning-engine build
RUN cd packages/database && npx prisma generate
RUN pnpm --filter @pm-app/database build
RUN pnpm --filter @pm-app/backend build

### Production stage ###
FROM node:20-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S -G appgroup appuser

# Copy built artifacts and dependencies from builder
COPY --from=builder --chown=appuser:appgroup /app ./

USER appuser

EXPOSE 3001

# Run migrations then start server (PORT is set by Railway at runtime)
CMD ["sh", "-c", "cd packages/database && npx prisma migrate deploy && cd ../.. && node packages/backend/dist/server.js"]
