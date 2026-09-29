FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Install tsx for runtime transpilation (no build step needed)
RUN npm install tsx

EXPOSE 3030

ENV NODE_ENV=production

CMD ["./node_modules/.bin/tsx", "src/reception/index.ts"]
