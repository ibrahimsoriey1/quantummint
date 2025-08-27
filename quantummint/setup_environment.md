# Development Environment Setup for Digital Money Generation System

This document provides step-by-step instructions for setting up the development environment for the Digital Money Generation System.

## Prerequisites

Before starting, ensure you have the following installed:

- Node.js (v16.x or later)
- npm (v8.x or later)
- MongoDB (v5.0 or later)
- Redis (v6.x or later)
- Git

## Project Structure

The project follows a microservices architecture with the following structure:

```
digital-money-system/
├── api-gateway/            # API Gateway service
├── auth-service/           # Authentication service
├── money-generation/       # Money generation service
├── transaction-service/    # Transaction processing service
├── payment-integration/    # Payment provider integration service
├── analytics-service/      # Analytics and reporting service
├── frontend/               # React frontend application
├── shared/                 # Shared libraries and utilities
└── docker/                 # Docker configuration files
```

## Step 1: Clone the Repository

```bash
# Create project directory
mkdir -p digital-money-system
cd digital-money-system

# Initialize git repository
git init
```

## Step 2: Set Up API Gateway

```bash
# Create API Gateway directory
mkdir -p api-gateway
cd api-gateway

# Initialize Node.js project
npm init -y

# Install dependencies
npm install express cors helmet express-rate-limit compression dotenv jsonwebtoken axios winston morgan

# Install development dependencies
npm install --save-dev nodemon eslint jest supertest

# Create basic directory structure
mkdir -p src/routes src/middleware src/config src/utils src/tests

# Create main server file
touch src/server.js
```

## Step 3: Set Up Authentication Service

```bash
# Navigate back to root directory
cd ..

# Create Authentication Service directory
mkdir -p auth-service
cd auth-service

# Initialize Node.js project
npm init -y

# Install dependencies
npm install express mongoose bcrypt jsonwebtoken redis dotenv winston express-validator uuid speakeasy qrcode nodemailer

# Install development dependencies
npm install --save-dev nodemon eslint jest supertest

# Create basic directory structure
mkdir -p src/models src/controllers src/routes src/middleware src/config src/utils src/tests

# Create main server file
touch src/server.js
```

## Step 4: Set Up Money Generation Service

```bash
# Navigate back to root directory
cd ..

# Create Money Generation Service directory
mkdir -p money-generation
cd money-generation

# Initialize Node.js project
npm init -y

# Install dependencies
npm install express mongoose redis amqplib dotenv winston crypto-js express-validator

# Install development dependencies
npm install --save-dev nodemon eslint jest supertest

# Create basic directory structure
mkdir -p src/models src/controllers src/routes src/middleware src/config src/utils src/tests

# Create main server file
touch src/server.js
```

## Step 5: Set Up Transaction Service

```bash
# Navigate back to root directory
cd ..

# Create Transaction Service directory
mkdir -p transaction-service
cd transaction-service

# Initialize Node.js project
npm init -y

# Install dependencies
npm install express mongoose redis amqplib dotenv winston express-validator uuid

# Install development dependencies
npm install --save-dev nodemon eslint jest supertest

# Create basic directory structure
mkdir -p src/models src/controllers src/routes src/middleware src/config src/utils src/tests

# Create main server file
touch src/server.js
```

## Step 6: Set Up Payment Integration Service

```bash
# Navigate back to root directory
cd ..

# Create Payment Integration Service directory
mkdir -p payment-integration
cd payment-integration

# Initialize Node.js project
npm init -y

# Install dependencies
npm install express axios mongoose redis amqplib dotenv winston crypto-js express-validator

# Install development dependencies
npm install --save-dev nodemon eslint jest supertest

# Create basic directory structure
mkdir -p src/models src/controllers src/routes src/middleware src/config src/utils src/providers src/tests

# Create main server file
touch src/server.js
```

## Step 7: Set Up Frontend Application

```bash
# Navigate back to root directory
cd ..

# Create React application using create-react-app
npx create-react-app frontend

# Navigate to frontend directory
cd frontend

# Install additional dependencies
npm install axios react-router-dom redux react-redux redux-thunk @mui/material @mui/icons-material formik yup jwt-decode recharts

# Create basic directory structure
mkdir -p src/components src/pages src/redux src/utils src/hooks src/api src/assets
```

## Step 8: Set Up Shared Libraries

```bash
# Navigate back to root directory
cd ..

# Create Shared directory
mkdir -p shared
cd shared

# Initialize Node.js project
npm init -y

# Install dependencies
npm install joi mongoose winston crypto-js

# Create basic directory structure
mkdir -p src/models src/validation src/utils src/constants
```

## Step 9: Set Up Docker Environment

```bash
# Navigate back to root directory
cd ..

# Create Docker directory
mkdir -p docker
cd docker

# Create Docker Compose file
touch docker-compose.yml

# Create service-specific Dockerfiles
touch api-gateway.Dockerfile auth-service.Dockerfile money-generation.Dockerfile transaction-service.Dockerfile payment-integration.Dockerfile frontend.Dockerfile

# Create network configuration
mkdir -p nginx
touch nginx/nginx.conf
```

## Step 10: Configure Environment Variables

Create `.env` files for each service with appropriate configuration:

```bash
# Navigate back to root directory
cd ..

# Create environment files for each service
touch api-gateway/.env auth-service/.env money-generation/.env transaction-service/.env payment-integration/.env
```

Example `.env` file for auth-service:

```
# Server Configuration
PORT=3001
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/digital_money_auth

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Email Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_email_password

# Two-Factor Authentication
TOTP_ISSUER=DigitalMoneySystem
```

## Step 11: Configure MongoDB

```bash
# Create MongoDB initialization script
mkdir -p mongodb
touch mongodb/init-mongo.js
```

Example `init-mongo.js`:

```javascript
// Create databases and users
db = db.getSiblingDB('digital_money_auth');
db.createUser({
  user: 'auth_service',
  pwd: 'auth_password',
  roles: [{ role: 'readWrite', db: 'digital_money_auth' }]
});

db = db.getSiblingDB('digital_money_generation');
db.createUser({
  user: 'generation_service',
  pwd: 'generation_password',
  roles: [{ role: 'readWrite', db: 'digital_money_generation' }]
});

db = db.getSiblingDB('digital_money_transactions');
db.createUser({
  user: 'transaction_service',
  pwd: 'transaction_password',
  roles: [{ role: 'readWrite', db: 'digital_money_transactions' }]
});

db = db.getSiblingDB('digital_money_payments');
db.createUser({
  user: 'payment_service',
  pwd: 'payment_password',
  roles: [{ role: 'readWrite', db: 'digital_money_payments' }]
});
```

## Step 12: Configure Docker Compose

Edit `docker/docker-compose.yml`:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:5.0
    container_name: mongodb
    restart: always
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: rootpassword
    volumes:
      - mongodb_data:/data/db
      - ./mongodb/init-mongo.js:/docker-entrypoint-initdb.d/init-mongo.js:ro
    networks:
      - digital_money_network

  redis:
    image: redis:6.2-alpine
    container_name: redis
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - digital_money_network

  api-gateway:
    build:
      context: ..
      dockerfile: docker/api-gateway.Dockerfile
    container_name: api-gateway
    restart: always
    ports:
      - "3000:3000"
    env_file:
      - ../api-gateway/.env
    depends_on:
      - auth-service
      - money-generation
      - transaction-service
      - payment-integration
    networks:
      - digital_money_network

  auth-service:
    build:
      context: ..
      dockerfile: docker/auth-service.Dockerfile
    container_name: auth-service
    restart: always
    env_file:
      - ../auth-service/.env
    depends_on:
      - mongodb
      - redis
    networks:
      - digital_money_network

  money-generation:
    build:
      context: ..
      dockerfile: docker/money-generation.Dockerfile
    container_name: money-generation
    restart: always
    env_file:
      - ../money-generation/.env
    depends_on:
      - mongodb
      - redis
    networks:
      - digital_money_network

  transaction-service:
    build:
      context: ..
      dockerfile: docker/transaction-service.Dockerfile
    container_name: transaction-service
    restart: always
    env_file:
      - ../transaction-service/.env
    depends_on:
      - mongodb
      - redis
    networks:
      - digital_money_network

  payment-integration:
    build:
      context: ..
      dockerfile: docker/payment-integration.Dockerfile
    container_name: payment-integration
    restart: always
    env_file:
      - ../payment-integration/.env
    depends_on:
      - mongodb
      - redis
    networks:
      - digital_money_network

  frontend:
    build:
      context: ..
      dockerfile: docker/frontend.Dockerfile
    container_name: frontend
    restart: always
    ports:
      - "80:80"
    depends_on:
      - api-gateway
    networks:
      - digital_money_network

networks:
  digital_money_network:
    driver: bridge

volumes:
  mongodb_data:
  redis_data:
```

## Step 13: Configure Nginx for Frontend

Create `docker/nginx/nginx.conf`:

```nginx
server {
    listen 80;
    server_name localhost;

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://api-gateway:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Step 14: Create Dockerfiles for Each Service

Example `docker/api-gateway.Dockerfile`:

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY api-gateway/package*.json ./

RUN npm install

COPY api-gateway/ .
COPY shared/ ../shared/

EXPOSE 3000

CMD ["npm", "start"]
```

Create similar Dockerfiles for other services.

## Step 15: Configure ESLint

Create `.eslintrc.js` in the root directory:

```javascript
module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    'no-console': 'warn',
    'no-unused-vars': 'warn',
  },
};
```

## Step 16: Configure Jest for Testing

Create `jest.config.js` in each service directory:

```javascript
module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  coverageReporters: ['text', 'lcov', 'clover'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
};
```

## Step 17: Create Basic Scripts

Update `package.json` in each service directory with useful scripts:

```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  }
}
```

## Step 18: Create Root Package.json for Project Management

Create a `package.json` file in the root directory:

```json
{
  "name": "digital-money-system",
  "version": "1.0.0",
  "description": "Digital Money Generation System",
  "scripts": {
    "start:api-gateway": "cd api-gateway && npm run dev",
    "start:auth": "cd auth-service && npm run dev",
    "start:generation": "cd money-generation && npm run dev",
    "start:transaction": "cd transaction-service && npm run dev",
    "start:payment": "cd payment-integration && npm run dev",
    "start:frontend": "cd frontend && npm start",
    "start:all": "concurrently &quot;npm run start:api-gateway&quot; &quot;npm run start:auth&quot; &quot;npm run start:generation&quot; &quot;npm run start:transaction&quot; &quot;npm run start:payment&quot; &quot;npm run start:frontend&quot;",
    "install:all": "npm install && cd api-gateway && npm install && cd ../auth-service && npm install && cd ../money-generation && npm install && cd ../transaction-service && npm install && cd ../payment-integration && npm install && cd ../frontend && npm install && cd ../shared && npm install",
    "test:all": "cd api-gateway && npm test && cd ../auth-service && npm test && cd ../money-generation && npm test && cd ../transaction-service && npm test && cd ../payment-integration && npm test && cd ../frontend && npm test",
    "docker:up": "docker-compose -f docker/docker-compose.yml up -d",
    "docker:down": "docker-compose -f docker/docker-compose.yml down",
    "docker:build": "docker-compose -f docker/docker-compose.yml build"
  },
  "devDependencies": {
    "concurrently": "^7.0.0"
  }
}
```

## Step 19: Create a README.md File

Create a `README.md` file in the root directory:

```markdown
# Digital Money Generation System

A comprehensive system for generating digital money and enabling cash-out functionality through Orange Money and AfriMoney.

## Features

- User authentication and authorization
- Digital money generation
- Transaction processing
- Integration with Orange Money and AfriMoney
- Advanced security measures
- Admin dashboard for monitoring and management

## Getting Started

### Prerequisites

- Node.js (v16.x or later)
- npm (v8.x or later)
- MongoDB (v5.0 or later)
- Redis (v6.x or later)
- Docker and Docker Compose (optional)

### Installation

1. Clone the repository
2. Install dependencies: `npm run install:all`
3. Configure environment variables in each service's `.env` file
4. Start all services: `npm run start:all`

### Docker Setup

1. Build Docker images: `npm run docker:build`
2. Start Docker containers: `npm run docker:up`
3. Stop Docker containers: `npm run docker:down`

## Project Structure

- `api-gateway`: API Gateway service
- `auth-service`: Authentication service
- `money-generation`: Money generation service
- `transaction-service`: Transaction processing service
- `payment-integration`: Payment provider integration service
- `frontend`: React frontend application
- `shared`: Shared libraries and utilities
- `docker`: Docker configuration files

## Development

- Run tests: `npm run test:all`
- Start individual services: `npm run start:[service-name]`

## License

This project is licensed under the MIT License - see the LICENSE file for details.
```

## Step 20: Initialize Git Repository

```bash
# Add .gitignore file
cat > .gitignore << EOL
# Dependencies
node_modules/
.pnp/
.pnp.js

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build files
build/
dist/
coverage/

# Misc
.DS_Store
.idea/
.vscode/
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Docker volumes
docker-volumes/
EOL

# Initialize git repository
git add .
git commit -m "Initial project setup"
```

## Running the Development Environment

### Option 1: Running Services Individually

```bash
# Start MongoDB and Redis
mongod --dbpath /path/to/data/db
redis-server

# Start each service in a separate terminal
cd api-gateway && npm run dev
cd auth-service && npm run dev
cd money-generation && npm run dev
cd transaction-service && npm run dev
cd payment-integration && npm run dev
cd frontend && npm start
```

### Option 2: Running with Concurrently

```bash
# From the root directory
npm run start:all
```

### Option 3: Running with Docker

```bash
# From the root directory
npm run docker:up
```

## Accessing the Application

- Frontend: http://localhost:3000
- API Gateway: http://localhost:3000/api
- Swagger Documentation: http://localhost:3000/api-docs

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Check if MongoDB is running: `ps aux | grep mongo`
   - Verify connection string in `.env` file

2. **Redis Connection Error**
   - Check if Redis is running: `ps aux | grep redis`
   - Verify Redis configuration in `.env` file

3. **Service Dependencies**
   - Ensure services are started in the correct order
   - Check logs for dependency-related errors

4. **Docker Issues**
   - Check container status: `docker ps -a`
   - View container logs: `docker logs [container_name]`
   - Rebuild containers if needed: `npm run docker:build`