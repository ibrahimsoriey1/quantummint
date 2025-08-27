FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Create logs directory
RUN mkdir -p logs

EXPOSE 3002

CMD ["npm", "run", "dev"]