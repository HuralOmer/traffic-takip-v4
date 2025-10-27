# Node.js 18 Alpine base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/universal-tracking/package.json ./services/universal-tracking/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY services/universal-tracking/src ./services/universal-tracking/src
COPY services/universal-tracking/tsconfig.json ./services/universal-tracking/
COPY services/universal-tracking/tsup.config.ts ./services/universal-tracking/
COPY services/universal-tracking/tsup.config.browser.ts ./services/universal-tracking/

# Build the application (Node.js backend + Browser bundle)
RUN pnpm --filter "@universal-tracking/service" run build:all

# Expose ports
EXPOSE 3001
EXPOSE 3003

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the application
CMD ["pnpm", "--filter", "@universal-tracking/service", "start"]
