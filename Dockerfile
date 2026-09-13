
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
# 1. This step creates the missing 'dist' or '.output' folder
RUN npm run build

# 2. Expose the port you configured in Railway
EXPOSE 8787

# 3. Start using Node directly, NOT wrangler
CMD ["node", "dist/server/index.mjs"] 
