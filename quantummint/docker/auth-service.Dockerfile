# Dockerfile for the Authentication Service
#
FROM node:16-alpine

WORKDIR /app

COPY auth-service/package*.json ./

RUN npm install --omit=dev

COPY auth-service/ .
COPY shared/ ../shared/

EXPOSE 3001

CMD ["npm", "start"]