# syntax=docker/dockerfile:1

# ---- Build stage: install all deps and compile the SvelteKit (adapter-node) app ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Install dependencies first for better layer caching. A Debian (glibc) base is deliberate: it lets
# better-sqlite3 use its prebuilt binary, so no python/make/g++ build toolchain is needed here.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Drop devDependencies so only runtime deps (notably the native better-sqlite3) travel to the image.
RUN npm prune --omit=dev

# ---- Runtime stage: minimal image that just runs the built Node server ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# adapter-node reads these. HOST 0.0.0.0 so the container is reachable; override PORT if you like.
ENV HOST=0.0.0.0
ENV PORT=3000

# The SQLite database lives on a mounted volume so data survives image updates (see docker-compose.yml).
ENV DATABASE_PATH=/data/reading-tracker.db

COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Run unprivileged. The built-in `node` user owns /data; with a named volume Docker preserves this
# ownership, so the app can create and write the database.
RUN mkdir -p /data && chown -R node:node /data
USER node

VOLUME /data
EXPOSE 3000
CMD ["node", "build"]
