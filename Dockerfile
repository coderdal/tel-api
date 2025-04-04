FROM ghcr.io/puppeteer/puppeteer:22.0.0

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

USER root

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN chown -R pptruser:pptruser /app

USER pptruser

CMD [ "node", "src/index.js" ]