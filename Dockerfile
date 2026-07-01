# ─── Build stage ─────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app

# whatsapp-web.js pulls puppeteer; skip its Chromium download (we use system chromium).
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─── Runtime stage ───────────────────────────────────────────
FROM node:22-bookworm-slim
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# System Chromium + the shared libraries whatsapp-web.js/puppeteer needs.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      ca-certificates \
      fonts-liberation \
      libnss3 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdrm2 \
      libgbm1 libgtk-3-0 libx11-xcb1 libxcomposite1 libxdamage1 \
      libxrandr2 libasound2 libpangocairo-1.0-0 \
      dumb-init \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# Session persistence directory (mount a volume here).
ENV SESSION_DATA_PATH=/app/.wwebjs_auth
RUN mkdir -p /app/.wwebjs_auth

EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/app.js"]
