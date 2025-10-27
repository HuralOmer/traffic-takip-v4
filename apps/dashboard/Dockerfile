# Node.js 18 Alpine base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/dashboard/package.json ./apps/dashboard/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/dashboard/src ./apps/dashboard/src
COPY apps/dashboard/index.html ./apps/dashboard/
COPY apps/dashboard/vite.config.ts ./apps/dashboard/
COPY apps/dashboard/tsconfig.json ./apps/dashboard/
COPY apps/dashboard/tsconfig.node.json ./apps/dashboard/
COPY apps/dashboard/postcss.config.js ./apps/dashboard/

# Build the application
RUN pnpm run build

# Expose port
EXPOSE 3002

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3002 || exit 1

# Start the application
CMD ["pnpm", "--filter", "@universal-tracking/dashboard", "preview", "--port", "3002", "--host"]



