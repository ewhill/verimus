FROM node:23-alpine

WORKDIR /app

# Install native compilation dependencies for cryptographic modules and bash
RUN apk add --no-cache python3 make g++ bash git openssl

COPY package*.json ./
# Install UI dependencies exactly matching the package-lock configuration
COPY ui/package*.json ./ui/

RUN npm ci
RUN cd ui && npm ci

COPY . .

# Prebuild the UI
RUN npm run build:ui

RUN chmod +x scripts/docker-entrypoint.sh

EXPOSE 26780 26781 26782 26783 26784

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
