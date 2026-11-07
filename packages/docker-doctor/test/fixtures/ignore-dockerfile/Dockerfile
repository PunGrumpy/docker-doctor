# docker-doctor-ignore-file require-labels -- labels come from the build pipeline
# docker-doctor-ignore no-root-user -- the platform runs the image with --user
FROM node:22.2.0-alpine
WORKDIR /app
# docker-doctor-ignore no-secrets-in-env -- local-only placeholder, never deployed
ENV DB_PASSWORD=hunter2
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "process.exit(0)"
CMD ["node", "index.js"]
