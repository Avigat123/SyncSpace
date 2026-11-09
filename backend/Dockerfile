FROM node:22-alpine

# Set production environment
ENV NODE_ENV=production

WORKDIR /app

# Copy dependency specifications first to leverage Docker layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source code with non-root ownership
COPY --chown=node:node . .

# Run as non-root user
USER node

# Expose backend API / Socket.IO port
EXPOSE 5000

# Execute server directly so node receives OS signals (SIGTERM, SIGINT) for graceful shutdown
CMD ["node", "src/server.js"]
