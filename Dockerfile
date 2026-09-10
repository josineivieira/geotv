FROM node:24-bookworm-slim

# PowerPoint is converted locally; PDF rendering runs in the browser.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libreoffice-impress fonts-dejavu-core fonts-liberation ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY web ./web

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    GEOTV_STORAGE=/var/data/geotv \
    LIBREOFFICE_PATH=/usr/bin/libreoffice \
    COOKIE_SECURE=true

CMD ["node", "server/index.js"]
