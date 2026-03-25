# Multi-stage Dockerfile limiting final container bloat
FROM node:20-slim AS builder

WORKDIR /usr/src/app

# Install project dependencies
COPY package*.json ./
COPY ui/package*.json ./ui/

# Execute clean install skipping heavy optional bindings if possible
RUN npm ci 
RUN cd ui && npm ci

# Copy full application logic
COPY . .

# Build the React/Vite Front-End statically
RUN npm run build:ui


# Target Production Stage
FROM node:20-slim

WORKDIR /usr/src/app

# Copy built application and modules from builder
COPY --from=builder /usr/src/app ./

# Setup explicit infrastructure mapping targets locally representing physical storage
RUN mkdir -p data keys

# Port 26780 Maps standard Master Peer execution & Web UI
EXPOSE 26780

ENTRYPOINT ["npm", "start", "--"]
