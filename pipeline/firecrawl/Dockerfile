FROM node:22-slim AS builder

# Install ca-certificates first so git clone works over HTTPS
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates \
  && apt-get install -y git python3 make g++ --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /build
RUN GIT_SSL_NO_VERIFY=false git clone --depth=1 https://github.com/mendableai/firecrawl.git .

# Must run npm install from monorepo root — apps/api uses workspace:* deps
RUN npm install --legacy-peer-deps 2>&1
RUN cd apps/api && npm run build 2>&1 || true

FROM node:22-slim

RUN apt-get update && apt-get install -y \
    redis-server \
    chromium \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxss1 \
    libasound2 \
    supervisor \
    --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Copy whole monorepo — workspace symlinks need packages/* to be present
WORKDIR /app
COPY --from=builder /build /app

COPY supervisord.conf /etc/supervisor/conf.d/firecrawl.conf

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROME_PATH=/usr/bin/chromium
ENV USE_DB_AUTHENTICATION=false
ENV REDIS_URL=redis://127.0.0.1:6379
ENV REDIS_RATE_LIMIT_URL=redis://127.0.0.1:6379
ENV PORT=3002
ENV NODE_ENV=production
# Path to firecrawl api within monorepo
WORKDIR /app/apps/api

EXPOSE 3002

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/firecrawl.conf"]
