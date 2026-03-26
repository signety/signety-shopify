# Shopify Remix app Dockerfile for Coolify deployment
FROM node:20-alpine

# Install OpenSSL (required by Prisma on Alpine)
RUN apk add --no-cache openssl

WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create SQLite database with schema (at build time)
RUN npx prisma db push --accept-data-loss

# Build Remix app
RUN npm run build

# Expose port
ENV PORT=3000
EXPOSE 3000

# Start server (no migration needed — db push already applied schema)
CMD ["npm", "run", "start"]
