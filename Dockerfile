FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json index.html styles.css script.js sono-logo.svg sono-mark.svg ./
COPY server ./server
COPY admin ./admin
RUN mkdir -p /data/sono && chown -R node:node /data/sono
USER node
ENV PORT=4318 SONO_HOST=0.0.0.0 SONO_DATA_DIR=/data/sono
EXPOSE 4318
VOLUME ["/data/sono"]
# Supply SONO_ORIGIN=https://your-host.example behind an HTTPS reverse proxy.
CMD ["node", "server/index.mjs"]
