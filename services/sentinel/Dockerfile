FROM node:alpine
WORKDIR /usr/app
COPY . .
RUN npm ci
CMD ["node", "/usr/app/src/index.js"]
