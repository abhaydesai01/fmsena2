# syntax=docker/dockerfile:1.6

# ─── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies first (better Docker layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Copy the rest of the source and build
COPY . .
RUN npm run build:railway

# Prune dev dependencies for a smaller runtime image
RUN npm prune --omit=dev

# ─── Stage 2: production runtime ─────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy only what's needed to run the server
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node-server.mjs ./node-server.mjs
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["node", "node-server.mjs"]
