# 🚀 QuantumMint Deployment Guide

## Overview
This guide will help you deploy your updated QuantumMint application with the new database schema and authentication fixes.

## ✅ What's Been Fixed
- **Authentication Issues**: Fixed "unexpected error occurred" during login/registration
- **Database Schema**: Updated to use `passwordHash` instead of `password`
- **User Model**: Enhanced with new fields and validation
- **Shared Modules**: Fixed dependency issues

## 🐳 Docker Deployment

### Prerequisites
- Docker and Docker Compose installed
- MongoDB running (if not using Docker)
- Redis running (if not using Docker)

### Step 1: Environment Variables
Create a `.env` file in the `docker` directory with the following variables:

```bash
# Database
MONGO_USERNAME=your_mongo_username
MONGO_PASSWORD=your_mongo_password

# JWT Secrets
JWT_SECRET=your_jwt_secret_key
REFRESH_TOKEN_SECRET=your_refresh_token_secret

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_email_password
EMAIL_FROM=noreply@quantummint.com

# Service Configuration
SERVICE_KEY=your_service_key
CORS_ORIGIN=http://localhost:3006
FRONTEND_URL=http://localhost:3006

# Payment Providers (Optional)
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
ORANGE_MONEY_API_KEY=your_orange_money_api_key
ORANGE_MONEY_API_SECRET=your_orange_money_api_secret
AFRIMONEY_API_KEY=your_afrimoney_api_key
AFRIMONEY_API_SECRET=your_afrimoney_api_secret

# Storage (Optional)
STORAGE_TYPE=local
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your_s3_bucket

# RabbitMQ
RABBITMQ_USERNAME=your_rabbitmq_username
RABBITMQ_PASSWORD=your_rabbitmq_password
```

### Step 2: Build and Deploy

#### For Development:
```bash
cd docker
docker-compose -f docker-compose.dev.yml up --build
```

#### For Production:
```bash
cd docker
docker-compose -f docker-compose.prod.yml up --build -d
```

### Step 3: Verify Deployment

Check if all services are running:
```bash
docker ps
```

You should see:
- `quantummint-mongodb` (port 27017)
- `quantummint-redis` (port 6379)
- `quantummint-rabbitmq` (ports 5672, 15672)
- `quantummint-api-gateway` (port 3000)
- `quantummint-auth-service` (port 3001)
- `quantummint-money-generation` (port 3002)
- `quantummint-transaction-service` (port 3003)
- `quantummint-payment-integration` (port 3004)
- `quantummint-kyc-service` (port 3005)
- `quantummint-frontend` (port 3006)

## 🔧 Manual Deployment (Without Docker)

### Step 1: Start Dependencies
```bash
# Start MongoDB
mongod

# Start Redis
redis-server
```

### Step 2: Start Services
Open separate terminal windows for each service:

```bash
# Terminal 1 - Auth Service
cd auth-service
npm install
npm start

# Terminal 2 - API Gateway
cd api-gateway
npm install
npm start

# Terminal 3 - Money Generation Service
cd money-generation
npm install
npm start

# Terminal 4 - Transaction Service
cd transaction-service
npm install
npm start

# Terminal 5 - Payment Integration Service
cd payment-integration
npm install
npm start

# Terminal 6 - KYC Service
cd kyc-service
npm install
npm start

# Terminal 7 - Frontend
cd frontend
npm install
npm start
```

## 🧪 Testing the Application

### 1. Test Authentication
- Navigate to `http://localhost:3006` (frontend)
- Try to register a new user
- Try to login with existing credentials
- The "unexpected error occurred" message should be resolved

### 2. Test API Endpoints
```bash
# Test registration
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'

# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

## 🔍 Troubleshooting

### Common Issues:

1. **"Unexpected error occurred" still appears**
   - Check if auth-service is running on port 3001
   - Check if API gateway is running on port 3000
   - Verify database connection

2. **Database connection errors**
   - Ensure MongoDB is running
   - Check connection string in environment variables
   - Verify database credentials

3. **Services not starting**
   - Check if ports are already in use
   - Verify all dependencies are installed
   - Check logs for specific error messages

### Logs:
```bash
# View service logs
docker logs quantummint-auth-service
docker logs quantummint-api-gateway
docker logs quantummint-frontend

# View all logs
docker-compose logs -f
```

## 📊 Monitoring

### Health Checks:
- API Gateway: `http://localhost:3000/health`
- Auth Service: `http://localhost:3001/health`
- Frontend: `http://localhost:3006`

### API Documentation:
- Swagger UI: `http://localhost:3000/api-docs`

## 🔄 Updates and Maintenance

### To update the application:
1. Pull latest changes
2. Rebuild Docker images: `docker-compose up --build`
3. Run migrations if needed
4. Restart services

### Database Backups:
```bash
# Backup MongoDB
mongodump --uri="mongodb://username:password@localhost:27017/quantummint_auth"

# Restore MongoDB
mongorestore --uri="mongodb://username:password@localhost:27017/quantummint_auth" dump/
```

## 🎯 Success Indicators

Your deployment is successful when:
- ✅ All Docker containers are running
- ✅ Frontend loads without errors
- ✅ User registration works
- ✅ User login works
- ✅ No "unexpected error occurred" messages
- ✅ API endpoints respond correctly
- ✅ Database connections are stable

## 📞 Support

If you encounter any issues:
1. Check the logs first
2. Verify environment variables
3. Ensure all dependencies are running
4. Check network connectivity between services

The authentication issues have been resolved, and your application should now work properly with the updated database schema!
