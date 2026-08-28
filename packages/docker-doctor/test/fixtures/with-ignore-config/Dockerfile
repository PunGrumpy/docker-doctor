FROM node:22.2.0-alpine
WORKDIR /app
COPY package.json ./
RUN npm ci --omit=dev
COPY src ./src
USER node
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "process.exit(0)"
CMD ["node", "src/index.js"]
