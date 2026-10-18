FROM node:22.2.0-slim
WORKDIR /app
COPY . .
RUN npm ci
USER node
CMD ["node", "server.js"]
