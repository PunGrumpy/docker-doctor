FROM node:latest
ENV DB_PASSWORD=hunter2
ADD https://example.com/file-27.tar.gz /app/file-27.tar.gz
RUN apt-get update
RUN apt-get install -y curl
WORKDIR app
CMD node index.js
