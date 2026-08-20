FROM node:22-alpine

# Stockfish is invoked as an external binary by src/engine/stockfish.ts.
# Alpine puts it in /usr/bin; on Ubuntu hosts it is /usr/games/stockfish.
RUN apk add --no-cache stockfish

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Env files are excluded from the image (see .dockerignore) because they hold
# the shared secret. NODE_ENV selects .env.production, which will not be
# present here — the service logs that and runs on these variables plus
# whatever the runtime injects (`docker run --env-file ...`).
ENV NODE_ENV=production
ENV STOCKFISH_PATH=/usr/bin/stockfish
EXPOSE 8090

# ANALYSIS_SERVICE_KEY must be supplied at run time; without it the service
# refuses to start in production rather than accepting unauthenticated calls.
CMD ["npm", "start"]
