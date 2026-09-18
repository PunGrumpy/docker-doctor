FROM node:22.2.0-slim
LABEL org.opencontainers.image.source="https://github.com/example/app"
WORKDIR /app
COPY package.json ./
USER node
HEALTHCHECK CMD ["node", "healthcheck.js"]
CMD ["node", "server.js"]
