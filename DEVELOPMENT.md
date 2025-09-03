# QuantumMint Development Guide

This guide provides comprehensive instructions for setting up, developing, and deploying the QuantumMint digital money generation platform.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Setup](#project-setup)
3. [Development Workflow](#development-workflow)
4. [Service Architecture](#service-architecture)
5. [Testing](#testing)
6. [Deployment](#deployment)
7. [Troubleshooting](#troubleshooting)
8. [Contributing](#contributing)

## Prerequisites

Before you begin development, ensure you have the following installed:

### Required Software
- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **npm** (v6 or higher) - Comes with Node.js
- **MongoDB** (v5 or higher) - [Download](https://www.mongodb.com/try/download/community)
- **Redis** (v6 or higher) - [Download](https://redis.io/download)
- **RabbitMQ** (v3.8 or higher) - [Download](https://www.rabbitmq.com/download.html)
- **Git** - [Download](https://git-scm.com/)

### Optional Software
- **Docker** & **Docker Compose** - [Download](https://www.docker.com/products/docker-desktop)
- **Postman** or **Insomnia** - For API testing
- **VS Code** - Recommended IDE with extensions

### System Requirements
- **RAM**: Minimum 8GB, Recommended 16GB+
- **Storage**: Minimum 10GB free space
- **OS**: Windows 10+, macOS 10.14+, or Linux (Ubuntu 18.04+)

## Project Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/quantummint.git
cd quantummint
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install all service dependencies
npm run install-all
```

### 3. Environment Configuration

Each service has its own environment configuration. Copy the example files and update them:

```bash
# Authentication Service
cp auth-service/env.example auth-service/.env

# Money Generation Service
cp money-generation/env.example money-generation/.env

# Transaction Service
cp transaction-service/env.example transaction-service/.env

# Payment Integration Service
cp payment-integration/env.example payment-integration/.env

# KYC Service
cp kyc-service/env.example kyc-service/.env

# API Gateway
cp api-gateway/env.example api-gateway/.env
```

### 4. Database Setup

#### MongoDB
```bash
# Start MongoDB service
sudo systemctl start mongod

# Create databases
mongosh
use quantummint_auth
use quantummint_money
use quantummint_transactions
use quantummint_payments
use quantummint_kyc
```

#### Redis
```bash
# Start Redis service
sudo systemctl start redis

# Test connection
redis-cli ping
```

#### RabbitMQ
```bash
# Start RabbitMQ service
sudo systemctl start rabbitmq-server

# Enable management plugin
sudo rabbitmq-plugins enable rabbitmq_management

# Create admin user
sudo rabbitmqctl add_user admin quantummint123
sudo rabbitmqctl set_user_tags admin administrator
sudo rabbitmqctl set_permissions -p / admin ".*" ".*" ".*"
```

### 5. Start Development Services

```bash
# Start all services in development mode
npm run start

# Or start individual services
npm run start:gateway
npm run start:auth
npm run start:money
npm run start:transaction
npm run start:payment
npm run start:kyc
npm run start:frontend
```

## Development Workflow

### 1. Service Development

Each service follows a similar structure:

```
service-name/
├── config/           # Configuration files
├── controllers/      # Business logic
├── middleware/       # Custom middleware
├── models/          # Database models
├── routes/          # API routes
├── services/        # Business services
├── utils/           # Utility functions
├── tests/           # Test files
├── server.js        # Main server file
└── package.json     # Dependencies
```

### 2. Code Style

- Use **ESLint** for code linting
- Follow **Prettier** formatting
- Use **JSDoc** for documentation
- Follow **RESTful** API design principles

### 3. Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: add your feature description"

# Push and create pull request
git push origin feature/your-feature-name
```

### 4. API Development

#### Adding New Endpoints

1. **Create Route**: Add route in `routes/` directory
2. **Add Controller**: Implement business logic in `controllers/`
3. **Add Validation**: Use Joi schemas for input validation
4. **Add Tests**: Write unit and integration tests
5. **Update Documentation**: Update API docs and README

#### Example Route Structure

```javascript
// routes/example.js
const express = require('express');
const { body } = require('express-validator');
const exampleController = require('../controllers/exampleController');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

const validation = [
  body('field').isString().withMessage('Field must be a string')
];

router.post('/example', 
  authenticateToken, 
  validation, 
  validateRequest, 
  exampleController.create
);

module.exports = router;
```

## Service Architecture

### 1. Authentication Service (Port 3001)

**Purpose**: User management, authentication, and authorization

**Key Features**:
- User registration and login
- JWT token management
- Two-factor authentication
- Password reset
- Email verification
- Role-based access control

**API Endpoints**:
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/refresh` - Token refresh
- `GET /api/v1/auth/me` - Get user profile

### 2. Money Generation Service (Port 3002)

**Purpose**: Digital money generation and wallet management

**Key Features**:
- Multiple generation methods (mining, staking, referral)
- Wallet creation and management
- Generation limits and controls
- Real-time generation tracking

**API Endpoints**:
- `POST /api/v1/generation/create` - Create generation
- `GET /api/v1/generation/history` - Get generation history
- `POST /api/v1/wallets/create` - Create wallet
- `GET /api/v1/wallets/balance` - Get wallet balance

### 3. Transaction Service (Port 3003)

**Purpose**: Financial transaction processing and management

**Key Features**:
- Transaction creation and processing
- Balance tracking
- Transaction history
- Fee calculation

**API Endpoints**:
- `POST /api/v1/transactions/create` - Create transaction
- `GET /api/v1/transactions/history` - Get transaction history
- `GET /api/v1/transactions/:id` - Get transaction details

### 4. Payment Integration Service (Port 3004)

**Purpose**: External payment provider integration

**Key Features**:
- Stripe integration
- Orange Money integration
- AfriMoney integration
- Webhook handling
- Payment method management

**API Endpoints**:
- `POST /api/v1/payments/create` - Create payment
- `POST /api/v1/payments/webhook` - Handle webhooks
- `GET /api/v1/payments/methods` - Get payment methods

### 5. KYC Service (Port 3005)

**Purpose**: Know Your Customer verification

**Key Features**:
- Identity verification
- Document upload and verification
- Verification status tracking
- Compliance management

**API Endpoints**:
- `POST /api/v1/kyc/profiles` - Create KYC profile
- `POST /api/v1/kyc/documents` - Upload documents
- `GET /api/v1/kyc/status` - Get verification status

### 6. API Gateway (Port 3000)

**Purpose**: Central entry point for all client requests

**Key Features**:
- Request routing and proxying
- Authentication verification
- Rate limiting
- Request/response transformation
- API documentation

**API Endpoints**:
- `GET /api-docs` - API documentation
- `GET /health` - Health check
- All proxied service endpoints

### 7. Frontend (Port 3006)

**Purpose**: React-based user interface

**Key Features**:
- User authentication flows
- Dashboard and wallet management
- Money generation interface
- Transaction history
- KYC verification forms

## Testing

### 1. Running Tests

```bash
# Run all tests
npm test

# Run tests for specific service
cd auth-service && npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### 2. Test Structure

```
tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
├── e2e/           # End-to-end tests
└── fixtures/      # Test data
```

### 3. Writing Tests

#### Unit Test Example

```javascript
// tests/unit/authController.test.js
const authController = require('../../controllers/authController');
const User = require('../../models/User');

describe('Auth Controller', () => {
  describe('register', () => {
    it('should create a new user successfully', async () => {
      const req = {
        body: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'TestPass123!',
          firstName: 'Test',
          lastName: 'User'
        }
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('registered successfully')
        })
      );
    });
  });
});
```

#### Integration Test Example

```javascript
// tests/integration/auth.test.js
const request = require('supertest');
const app = require('../../server');
const mongoose = require('mongoose');

describe('Auth API', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'TestPass123!',
          firstName: 'Test',
          lastName: 'User'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });
});
```

## Deployment

### 1. Docker Deployment

```bash
# Navigate to docker directory
cd docker

# Deploy development environment
./deploy.sh --environment dev --build

# Deploy production environment
./deploy.sh --environment prod --build

# Stop services
./deploy.sh --stop

# Clean up
./deploy.sh --clean
```

### 2. Manual Deployment

#### Production Environment Setup

1. **Server Requirements**:
   - Ubuntu 20.04+ or CentOS 8+
   - 4+ CPU cores
   - 16GB+ RAM
   - 100GB+ storage
   - SSL certificate

2. **Environment Variables**:
   ```bash
   NODE_ENV=production
   MONGODB_URI=mongodb://username:password@host:port/database
   REDIS_URL=redis://username:password@host:port
   JWT_SECRET=your-super-secret-jwt-key
   ```

3. **Process Management**:
   ```bash
   # Install PM2
   npm install -g pm2

   # Start services
   pm2 start ecosystem.config.js

   # Monitor services
   pm2 monit
   ```

### 3. CI/CD Pipeline

The project includes GitHub Actions for automated testing and deployment:

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to production
        run: echo "Deploy to production"
```

## Troubleshooting

### Common Issues

#### 1. MongoDB Connection Issues

```bash
# Check MongoDB status
sudo systemctl status mongod

# Check MongoDB logs
sudo journalctl -u mongod

# Test connection
mongosh --eval "db.adminCommand('ping')"
```

#### 2. Redis Connection Issues

```bash
# Check Redis status
sudo systemctl status redis

# Test Redis connection
redis-cli ping

# Check Redis logs
sudo journalctl -u redis
```

#### 3. Port Conflicts

```bash
# Check what's using a port
sudo netstat -tulpn | grep :3001

# Kill process using port
sudo kill -9 <PID>
```

#### 4. Permission Issues

```bash
# Fix file permissions
sudo chown -R $USER:$USER /path/to/project

# Fix npm permissions
sudo chown -R $USER:$USER ~/.npm
```

### Debug Mode

Enable debug logging by setting environment variables:

```bash
DEBUG=* npm run dev
LOG_LEVEL=debug npm run dev
```

### Health Checks

Check service health:

```bash
# API Gateway
curl http://localhost:3000/health

# Auth Service
curl http://localhost:3001/health

# Money Generation Service
curl http://localhost:3002/health
```

## Contributing

### 1. Development Guidelines

- Follow the existing code style and patterns
- Write comprehensive tests for new features
- Update documentation for API changes
- Use conventional commit messages
- Create descriptive pull requests

### 2. Code Review Process

1. Create feature branch from `develop`
2. Implement feature with tests
3. Create pull request
4. Address review comments
5. Merge after approval

### 3. Testing Requirements

- Unit tests: 90%+ coverage
- Integration tests for API endpoints
- E2E tests for critical user flows
- Performance tests for high-traffic endpoints

### 4. Documentation

- Update README.md for new features
- Add JSDoc comments for functions
- Update API documentation
- Create user guides for new features

## Support

### Getting Help

- **Documentation**: Check this guide and service READMEs
- **Issues**: Create GitHub issues for bugs
- **Discussions**: Use GitHub Discussions for questions
- **Community**: Join our community channels

### Resources

- [Node.js Documentation](https://nodejs.org/docs/)
- [Express.js Guide](https://expressjs.com/)
- [MongoDB Manual](https://docs.mongodb.com/)
- [Redis Documentation](https://redis.io/documentation)
- [RabbitMQ Tutorials](https://www.rabbitmq.com/tutorials.html)

---

**Happy Coding! 🚀**

For more information, visit our [main documentation](README.md) or contact the development team.
