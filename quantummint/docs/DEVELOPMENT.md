# QuantumMint Platform Development Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Project Structure](#project-structure)
4. [Development Workflow](#development-workflow)
5. [Environment Configuration](#environment-configuration)
6. [Running Services](#running-services)
7. [Testing](#testing)
8. [Code Quality](#code-quality)
9. [Database Setup](#database-setup)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- **Node.js** 18.0.0 or higher
- **npm** 8.0.0 or higher
- **Docker** 20.10.0 or higher
- **Docker Compose** 2.0.0 or higher
- **Git** 2.30.0 or higher

### Optional Tools

- **MongoDB Compass** - GUI for MongoDB
- **Redis CLI** - Redis command line interface
- **Postman** - API testing
- **VS Code** - Recommended IDE with extensions:
  - ESLint
  - Prettier
  - Jest
  - Docker
  - Thunder Client

## Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/quantummint/platform.git
cd quantummint

# Install all dependencies
npm run install:all
# or use the script
./scripts/install-all.sh  # Linux/macOS
.\scripts\install-all.bat # Windows
```

### 2. Environment Setup

```bash
# Copy environment files
cp .env.development.example .env.development
cp .env.docker.example .env.docker

# Edit configuration files with your settings
nano .env.development  # or use your preferred editor
```

### 3. Start Development Environment

```bash
# Start with Docker (recommended)
npm run dev

# Or start services individually
npm run start:dev
```

### 4. Access Applications

- **Frontend**: http://localhost:3001
- **API Gateway**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api-docs

## Project Structure

```
quantummint/
├── api-gateway/           # API Gateway service
│   ├── src/
│   │   ├── config/        # Configuration files
│   │   ├── middleware/    # Express middleware
│   │   └── utils/         # Utility functions
│   ├── tests/             # Test files
│   └── package.json
├── auth-service/          # Authentication service
├── transaction-service/   # Transaction management
├── payment-integration/   # Payment processing
├── kyc-service/          # KYC verification
├── money-generation/     # Money generation logic
├── frontend/             # React frontend application
├── shared/               # Shared utilities and models
├── scripts/              # Automation scripts
├── docs/                 # Documentation
├── docker-compose.yml    # Production Docker config
├── docker-compose.dev.yml # Development Docker config
└── package.json          # Root package configuration
```

### Service Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │────│  API Gateway    │
│   (React)       │    │  (Port 3000)    │
└─────────────────┘    └─────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
        ┌───────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
        │ Auth Service │ │Transaction  │ │  Payment   │
        │ (Port 3001)  │ │Service      │ │Integration │
        └──────────────┘ │(Port 3002)  │ │(Port 3004) │
                         └─────────────┘ └────────────┘
        ┌──────────────┐ ┌─────────────┐
        │ KYC Service  │ │Money        │
        │ (Port 3005)  │ │Generation   │
        └──────────────┘ │(Port 3003)  │
                         └─────────────┘
```

## Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and test
npm run test:all
npm run lint:all

# Commit changes
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/new-feature
```

### 2. Code Standards

- **Commit Messages**: Follow [Conventional Commits](https://www.conventionalcommits.org/)
- **Code Style**: ESLint configuration enforced
- **Testing**: Minimum 80% code coverage required
- **Documentation**: Update docs for API changes

### 3. Branch Strategy

- `main` - Production ready code
- `develop` - Integration branch
- `feature/*` - Feature development
- `hotfix/*` - Critical fixes
- `release/*` - Release preparation

## Environment Configuration

### Development Environment (.env.development)

```bash
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/quantummint_dev
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost:5672

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h

# Service Ports
API_GATEWAY_PORT=3000
AUTH_SERVICE_PORT=3001
TRANSACTION_SERVICE_PORT=3002
MONEY_GENERATION_PORT=3003
PAYMENT_INTEGRATION_PORT=3004
KYC_SERVICE_PORT=3005

# Payment Providers
STRIPE_SECRET_KEY=sk_test_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
ORANGE_MONEY_API_KEY=your_orange_money_key
AFRIMONEY_API_KEY=your_afrimoney_key

# File Upload
FILE_UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Logging
LOG_LEVEL=debug
LOG_FILE=./logs/app.log

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

### Docker Environment (.env.docker)

```bash
# Use Docker service names for internal communication
MONGODB_URI=mongodb://mongodb:27017/quantummint
REDIS_URL=redis://redis:6379
RABBITMQ_URL=amqp://rabbitmq:5672

# External access ports
API_GATEWAY_PORT=3000
FRONTEND_PORT=3001
```

## Running Services

### Development Mode

```bash
# Start all services with hot reload
npm run dev

# Start individual services
cd auth-service && npm run dev
cd transaction-service && npm run dev
cd frontend && npm start
```

### Production Mode

```bash
# Build and start all services
npm run build
npm start

# Or with Docker
docker-compose up -d
```

### Service Management

```bash
# View logs
npm run logs

# Stop services
npm run stop

# Restart services
docker-compose restart

# Clean up
npm run clean
```

## Testing

### Running Tests

```bash
# Run all tests
npm run test:all

# Run tests with coverage
npm run test:all:coverage

# Run specific service tests
cd auth-service && npm test

# Watch mode for development
npm run test:watch
```

### Test Structure

```
service/
├── tests/
│   ├── setup.js           # Test configuration
│   ├── service.test.js    # Service logic tests
│   ├── routes.test.js     # API endpoint tests
│   └── integration.test.js # Integration tests
```

### Writing Tests

```javascript
// Example test file
describe('Auth Service', () => {
  beforeEach(() => {
    // Setup test data
  });

  it('should register user successfully', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'password123'
    };
    
    const result = await authService.registerUser(userData);
    
    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('token');
  });
});
```

## Code Quality

### Linting

```bash
# Run linter on all services
npm run lint:all

# Fix linting issues automatically
npm run lint:all:fix

# Run linter on specific service
cd auth-service && npm run lint
```

### Code Formatting

```bash
# Format code with Prettier
npm run format

# Check formatting
npm run format:check
```

### Pre-commit Hooks

```bash
# Install pre-commit hooks
npm install husky --save-dev
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run precommit"
```

## Database Setup

### MongoDB

```bash
# Start MongoDB with Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Or install locally
# macOS: brew install mongodb-community
# Ubuntu: sudo apt install mongodb

# Initialize database
node scripts/mongo-init.js
```

### Redis

```bash
# Start Redis with Docker
docker run -d -p 6379:6379 --name redis redis:alpine

# Or install locally
# macOS: brew install redis
# Ubuntu: sudo apt install redis-server
```

### RabbitMQ

```bash
# Start RabbitMQ with Docker
docker run -d -p 5672:5672 -p 15672:15672 --name rabbitmq rabbitmq:management

# Access management UI: http://localhost:15672
# Default credentials: guest/guest
```

## Debugging

### VS Code Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Auth Service",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/auth-service/src/server.js",
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal"
    }
  ]
}
```

### Logging

```javascript
// Use Winston logger in services
const logger = require('./utils/logger');

logger.info('User registered', { userId: user.id });
logger.error('Database connection failed', error);
logger.debug('Processing request', { requestId });
```

### Health Checks

```bash
# Check service health
curl http://localhost:3000/health
curl http://localhost:3001/health

# Check database connections
curl http://localhost:3000/api/health/db
```

## Performance Monitoring

### Metrics Collection

```javascript
// Add performance monitoring
const prometheus = require('prom-client');

const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});
```

### Load Testing

```bash
# Install artillery
npm install -g artillery

# Run load test
artillery run load-test.yml
```

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

#### Database Connection Issues
```bash
# Check MongoDB status
docker ps | grep mongodb
mongosh --host localhost:27017

# Check Redis status
redis-cli ping
```

#### Memory Issues
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Or in package.json scripts
"start": "node --max-old-space-size=4096 src/server.js"
```

#### Docker Issues
```bash
# Clean Docker system
docker system prune -a

# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Getting Help

1. **Check Logs**: Always check service logs first
2. **Documentation**: Review API and service documentation
3. **Issues**: Search existing GitHub issues
4. **Community**: Join our Discord server
5. **Support**: Email dev-support@quantummint.com

### Development Tips

1. **Use Docker**: Consistent environment across team
2. **Hot Reload**: Enabled by default in development
3. **API Testing**: Use Postman collection in `/docs`
4. **Database GUI**: Use MongoDB Compass for data inspection
5. **Code Coverage**: Aim for >80% coverage on new code

## Next Steps

After setting up the development environment:

1. Review the [API Documentation](./API.md)
2. Check out the [Deployment Guide](./DEPLOYMENT.md)
3. Read the [Contributing Guidelines](./CONTRIBUTING.md)
4. Join our developer community
