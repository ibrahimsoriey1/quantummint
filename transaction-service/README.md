# Transaction Service - QuantumMint

The Transaction Service is a core microservice of the QuantumMint platform that handles all financial transactions, balance management, compliance checks, and fee calculations.

## 🚀 Features

### **Core Transaction Management**
- **Transaction Processing**: Handle all transaction types (transfer, withdrawal, deposit, generation, exchange)
- **Status Tracking**: Real-time transaction status updates with comprehensive state management
- **Retry Logic**: Automatic retry mechanism for failed transactions with configurable limits
- **Batch Processing**: Support for bulk transaction operations

### **Balance Management**
- **Multi-Currency Support**: USD, EUR, GBP, JPY, CAD, AUD
- **Balance Locking**: Secure amount locking during transaction processing
- **Limit Management**: Daily, monthly, and per-transaction limits with user tier support
- **Balance History**: Complete audit trail of all balance changes

### **Compliance & Security**
- **KYC Integration**: Automatic KYC level verification for high-value transactions
- **AML Monitoring**: Anti-money laundering pattern detection
- **Sanctions Checking**: Integration with external sanctions lists
- **PEP Screening**: Politically Exposed Person identification
- **Risk Scoring**: Dynamic risk assessment for transactions

### **Fee Management**
- **Dynamic Fee Calculation**: Percentage-based and fixed fee structures
- **User Tier Discounts**: Premium and enterprise user benefits
- **Transaction Type Adjustments**: Different fee structures per transaction type
- **Fee History**: Complete fee tracking and reporting

### **Statistics & Reporting**
- **Real-time Analytics**: Live transaction and balance statistics
- **Performance Metrics**: Response time, throughput, and error rate monitoring
- **Revenue Tracking**: Comprehensive fee and revenue analytics
- **Export Capabilities**: CSV, JSON, and Excel export formats

## 🏗️ Architecture

### **Service Dependencies**
- **MongoDB**: Primary data storage for transactions and balances
- **Redis**: Caching and session management
- **RabbitMQ**: Inter-service communication and event publishing
- **Auth Service**: User authentication and KYC verification
- **Money Generation Service**: Integration for generation transactions

### **Data Models**
- **Transaction**: Comprehensive transaction tracking with metadata
- **Balance**: Multi-currency balance management with limits
- **Compliance**: Audit trail for compliance checks and decisions

## 📡 API Endpoints

### **Transaction Management**
```
POST   /api/v1/transactions/create          # Create new transaction
GET    /api/v1/transactions/:id             # Get transaction details
GET    /api/v1/transactions/user/:userId    # Get user transactions
PUT    /api/v1/transactions/:id/process     # Process transaction
PUT    /api/v1/transactions/:id/cancel      # Cancel transaction
PUT    /api/v1/transactions/:id/retry       # Retry failed transaction
```

### **Balance Management**
```
GET    /api/v1/balance/:userId              # Get user balance
PUT    /api/v1/balance/:userId/lock         # Lock balance amount
PUT    /api/v1/balance/:userId/unlock       # Unlock balance amount
GET    /api/v1/balance/:userId/history      # Get balance history
PUT    /api/v1/balance/:userId/limits       # Update balance limits
```

### **Fee Management**
```
GET    /api/v1/fees/structure               # Get fee structure
POST   /api/v1/fees/calculate               # Calculate transaction fees
GET    /api/v1/fees/history                 # Get fee history
GET    /api/v1/fees/statistics              # Get fee statistics
PUT    /api/v1/fees/structure               # Update fee structure (Admin)
```

### **Compliance & Security**
```
POST   /api/v1/compliance/check             # Perform compliance check
GET    /api/v1/compliance/status/:id        # Get compliance status
GET    /api/v1/compliance/profile           # Get user compliance profile
GET    /api/v1/compliance/history           # Get compliance history
GET    /api/v1/compliance/flagged           # Get flagged transactions (Admin)
POST   /api/v1/compliance/review/:id        # Review flagged transaction (Admin)
```

### **Statistics & Reporting**
```
GET    /api/v1/stats/overview               # System overview statistics
GET    /api/v1/stats/transactions           # Transaction statistics
GET    /api/v1/stats/balance                # Balance statistics
GET    /api/v1/stats/user/:userId           # User-specific statistics
GET    /api/v1/stats/performance            # Performance metrics
GET    /api/v1/stats/revenue                # Revenue and fee statistics
GET    /api/v1/stats/compliance             # Compliance statistics
GET    /api/v1/stats/export                 # Export statistics data (Admin)
```

## 🔧 Environment Variables

```bash
# Server Configuration
NODE_ENV=development
PORT=3003
HOST=localhost

# Database Configuration
MONGODB_URI_DEV=mongodb://localhost:27017/quantum_mint_transactions_dev
MONGODB_URI_TEST=mongodb://localhost:27017/quantum_mint_transactions_test
MONGODB_URI_PROD=mongodb://localhost:27017/quantum_mint_transactions

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=1

# RabbitMQ Configuration
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_USERNAME=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_VHOST=/

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Service URLs
AUTH_SERVICE_URL=http://localhost:3001
MONEY_GENERATION_SERVICE_URL=http://localhost:3002
PAYMENT_SERVICE_URL=http://localhost:3004
KYC_SERVICE_URL=http://localhost:3005

# Transaction Configuration
TRANSACTION_FEE_PERCENTAGE=2.5
MIN_TRANSACTION_AMOUNT=1.00
MAX_TRANSACTION_AMOUNT=1000000.00
TRANSACTION_TIMEOUT_MINUTES=30
BATCH_PROCESSING_LIMIT=100

# Security Configuration
CORS_ORIGIN=http://localhost:3006
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
API_KEY_HEADER=X-API-Key
API_KEY=your-api-key-here

# Logging Configuration
LOG_LEVEL=info
LOG_FILE_PATH=./logs
LOG_MAX_SIZE=20m
LOG_MAX_FILES=14

# Monitoring Configuration
HEALTH_CHECK_INTERVAL=30000
METRICS_ENABLED=true
PROMETHEUS_PORT=9090

# External API Configuration
EXCHANGE_RATE_API_URL=https://api.exchangerate-api.com/v4/latest
EXCHANGE_RATE_API_KEY=your-exchange-rate-api-key
EXCHANGE_RATE_UPDATE_INTERVAL=3600000

# Notification Configuration
NOTIFICATION_WEBHOOK_URL=
NOTIFICATION_API_KEY=
ENABLE_EMAIL_NOTIFICATIONS=false
ENABLE_SMS_NOTIFICATIONS=false

# Compliance Configuration
COMPLIANCE_CHECK_ENABLED=true
AML_CHECK_ENABLED=true
KYC_REQUIRED_FOR_TRANSACTIONS=true
MIN_KYC_LEVEL_REQUIRED=verified

# Performance Configuration
CACHE_TTL_SECONDS=300
BATCH_PROCESSING_ENABLED=true
ASYNC_PROCESSING_ENABLED=true
TRANSACTION_QUEUE_SIZE=1000
```

## 🚀 Installation & Setup

### **Prerequisites**
- Node.js 18+ and npm 8+
- MongoDB 5+
- Redis 6+
- RabbitMQ 3.8+

### **Local Development**
```bash
# Clone the repository
git clone <repository-url>
cd transaction-service

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Configure environment variables
# Edit .env file with your configuration

# Start the service
npm run dev
```

### **Docker Deployment**
```bash
# Build the image
docker build -t quantum-mint-transaction-service .

# Run the container
docker run -d \
  --name transaction-service \
  -p 3003:3003 \
  --env-file .env \
  quantum-mint-transaction-service
```

### **Docker Compose**
```bash
# Start with all services
docker-compose up -d transaction-service

# View logs
docker-compose logs -f transaction-service
```

## 🧪 Testing

### **Run Tests**
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### **Test Coverage**
The service includes comprehensive test coverage for:
- Transaction creation and processing
- Balance management operations
- Fee calculations
- Compliance checks
- Error handling and edge cases

## 📊 Monitoring & Health Checks

### **Health Endpoint**
```
GET /health
```
Returns service status, uptime, and environment information.

### **Metrics Collection**
- Transaction processing times
- Error rates and types
- Balance operation performance
- Compliance check statistics
- Fee calculation accuracy

### **Logging**
- Structured logging with Winston
- Log rotation and archival
- Different log levels for development/production
- Audit trail for all financial operations

## 🔒 Security Features

### **Authentication & Authorization**
- JWT token validation
- Role-based access control (Admin, Moderator, User)
- Resource ownership verification
- Token blacklisting in Redis

### **Input Validation**
- Comprehensive request validation with express-validator
- SQL injection prevention
- XSS protection with Helmet
- Rate limiting to prevent abuse

### **Data Protection**
- Sensitive data encryption
- Secure communication with other services
- Audit logging for all operations
- Compliance with financial regulations

## 🔄 Transaction Flow

### **1. Transaction Creation**
```
User Request → Validation → Balance Check → Fee Calculation → Transaction Record
```

### **2. Transaction Processing**
```
Transaction Record → Compliance Check → Amount Locking → Processing → Balance Update
```

### **3. Completion**
```
Balance Update → Event Publishing → Notification → Audit Logging
```

## 📈 Performance Optimization

### **Caching Strategy**
- Redis caching for frequently accessed data
- Balance information caching
- Fee structure caching
- User compliance status caching

### **Database Optimization**
- Proper indexing on frequently queried fields
- Aggregation pipelines for statistics
- Connection pooling
- Query optimization

### **Async Processing**
- Non-blocking transaction processing
- Background compliance checks
- Event-driven architecture
- Queue-based processing

## 🚨 Error Handling

### **Error Types**
- **Validation Errors**: Invalid input data
- **Business Logic Errors**: Insufficient balance, limits exceeded
- **System Errors**: Database failures, service unavailability
- **Compliance Errors**: KYC requirements, suspicious activity

### **Error Responses**
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/transactions/create"
}
```

## 🔧 Configuration Management

### **Feature Flags**
- Compliance check enable/disable
- Fee calculation methods
- Transaction processing modes
- Monitoring and alerting

### **Dynamic Configuration**
- Fee structure updates
- Limit adjustments
- Compliance rule modifications
- Performance tuning parameters

## 📚 API Documentation

### **Swagger/OpenAPI**
The service includes comprehensive API documentation accessible at:
```
GET /api-docs
```

### **Request/Response Examples**
All endpoints include detailed examples in the documentation with:
- Request body schemas
- Response formats
- Error scenarios
- Authentication requirements

## 🚀 Deployment

### **Production Considerations**
- Environment-specific configurations
- Health check monitoring
- Log aggregation
- Performance monitoring
- Backup and recovery procedures

### **Scaling**
- Horizontal scaling with load balancers
- Database sharding strategies
- Cache distribution
- Queue partitioning

## 🤝 Contributing

### **Development Guidelines**
- Follow the established code style
- Include comprehensive tests
- Update documentation
- Follow security best practices

### **Code Review Process**
- All changes require review
- Security-focused review for financial operations
- Performance impact assessment
- Compliance requirement verification

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## 🆘 Support

### **Documentation**
- [API Reference](../docs/api.md)
- [Architecture Guide](../docs/architecture.md)
- [Deployment Guide](../docs/deployment.md)

### **Contact**
- **Issues**: [GitHub Issues](https://github.com/quantum-mint/transaction-service/issues)
- **Discussions**: [GitHub Discussions](https://github.com/quantum-mint/transaction-service/discussions)
- **Security**: [Security Policy](../SECURITY.md)

---

**Transaction Service** - Powering secure, compliant, and efficient financial transactions in the QuantumMint ecosystem.
