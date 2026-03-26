# Shopify Remix app Dockerfile for Coolify deployment
FROM node:20-alpine

WORKDIR /app

# Install deps (use npm install since no lock file in scaffold)
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Remix app
RUN npm run build

# Create SQLite data directory (persistent volume in Coolify)
RUN mkdir -p /app/prisma

# Expose port
ENV PORT=3000
EXPOSE 3000

# Run migrations + start server
CMD ["npm", "run", "docker-start"]
