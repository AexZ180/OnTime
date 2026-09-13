FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
ENV ONTIME_TARGET=railway
RUN node node_modules/vinext/dist/cli.js build
ENV NODE_ENV=production
CMD ["node", "scripts/railway-start.mjs"]
