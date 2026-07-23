FROM node:22.2.0-alpine
RUN <<EOF
apt-get update
apt-get install -y curl
EOF
USER node
CMD ["node", "index.js"]
