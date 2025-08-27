# Dockerfile for the Payment Integration Service
#
FROM node:16-alpine

WORKDIR /app

COPY payment-integration/package*.json ./

RUN npm install --omit=dev

COPY payment-integration/ .
COPY shared/ ../shared/

EXPOSE 3004

CMD ["npm", "start"]