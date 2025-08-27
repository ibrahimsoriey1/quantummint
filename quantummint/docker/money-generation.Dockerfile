# Dockerfile for the Money Generation Service
#
FROM node:16-alpine

WORKDIR /app

COPY money-generation/package*.json ./

RUN npm install --omit=dev

COPY money-generation/ .
COPY shared/ ../shared/

EXPOSE 3002

CMD ["npm", "start"]