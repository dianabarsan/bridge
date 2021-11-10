FROM node:alpine

RUN apk --no-cache add docker docker-compose
COPY . /app
RUN cd app && npm ci
ENTRYPOINT ["node", "/app/src/index.js"]
