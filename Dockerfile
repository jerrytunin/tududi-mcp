# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the project
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Set environment variables (can be overridden)
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# HTTP port used when TRANSPORT=http (default stdio mode ignores this)
EXPOSE 3000

# Run the server
CMD ["node", "dist/server.js"]

