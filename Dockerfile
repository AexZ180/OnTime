FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build:deploy
ENV NODE_ENV=production
CMD ["npm", "start"]
