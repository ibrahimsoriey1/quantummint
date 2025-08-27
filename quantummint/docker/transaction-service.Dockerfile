# Dockerfile for the Transaction Service
#
FROM node:16-alpine

WORKDIR /app

COPY transaction-service/package*.json ./

RUN npm install --omit=dev

COPY transaction-service/ .
COPY shared/ ../shared/

EXPOSE 3003

CMD ["npm", "start"]