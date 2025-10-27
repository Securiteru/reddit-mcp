# Reddit MCP Server Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including TypeScript)
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove dev dependencies and source after build
RUN npm prune --production && \
    rm -rf src tsconfig.json

# Set environment variables defaults
ENV NODE_ENV=production

# Expose health check (optional)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Run the MCP server
CMD ["node", "dist/index.js"]
