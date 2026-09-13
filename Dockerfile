# 1. Use the official lightweight Node.js image
FROM node:20-alpine

WORKDIR /app

# 2. Copy dependency manifests first to leverage Docker caching
COPY package*.json ./

# 3. Install ALL dependencies (including devDependencies needed for the build step)
RUN npm install

# 4. Copy the rest of your application source code
COPY . .

# 5. CRITICAL: Run the build step to generate 'dist/server/wrangler.json'
RUN npm run build

# 6. Expose the port Railway provided (8787)
EXPOSE 8787

# 7. Start the wrangler server properly bound to all network interfaces
CMD ["npx", "wrangler", "dev", "--port", "8787", "--ip", "0.0.0.0"]
