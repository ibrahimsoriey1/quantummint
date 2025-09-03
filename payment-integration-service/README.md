# Payment Integration Service

A comprehensive payment processing service for the QuantumMint platform that integrates with multiple payment providers, handles webhooks, manages settlements, and provides fraud detection capabilities.

## 🚀 Features

### Core Payment Processing
- **Multi-Provider Support**: Integration with Stripe, Orange Money, and AfriMoney
- **Payment Methods**: Credit cards, mobile money, bank transfers
- **Currency Support**: USD, EUR, GBP, XOF, XAF
- **Real-time Processing**: Instant payment confirmation and status updates

### Webhook Management
- **Provider Webhooks**: Handle incoming notifications from all payment providers
- **Signature Verification**: Secure webhook processing with signature validation
- **Retry Mechanism**: Automatic retry for failed webhook processing
- **Webhook History**: Complete audit trail of all webhook events

### Settlement Processing
- **Batch Settlements**: Group transactions for efficient settlement processing
- **Multi-Currency**: Support for multiple currencies in settlement batches
- **Settlement Scheduling**: Configurable settlement intervals and thresholds
- **Status Tracking**: Real-time settlement status monitoring

### Provider Management
- **Provider Configuration**: Easy setup and management of payment providers
- **Connection Testing**: Verify provider connectivity and API access
- **Provider Statistics**: Performance metrics and transaction analytics
- **Dynamic Configuration**: Update provider settings without service restart

### Exchange Rate Management
- **Real-time Rates**: Current exchange rates from multiple providers
- **Currency Conversion**: Accurate currency conversion calculations
- **Rate History**: Historical exchange rate data and trends
- **Fallback Rates**: Backup rates for service continuity

### Fraud Detection
- **Risk Scoring**: Advanced risk assessment algorithms
- **Rule Engine**: Configurable fraud detection rules
- **Real-time Analysis**: Instant fraud detection during payment processing
- **Alert Management**: Comprehensive fraud alert system

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client Apps   │    │  Payment Service │    │ Payment        │
│                 │◄──►│                  │◄──►│ Providers      │
│                 │    │                  │    │ (Stripe, etc.) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Message Queue  │
                       │   (RabbitMQ)     │
                       └──────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Cache Layer    │
                       │    (Redis)       │
                       └──────────────────┘
```

## 📡 API Endpoints

### Payment Processing
- `POST /api/v1/payments/process` - Process new payment
- `GET /api/v1/payments/:paymentId` - Get payment details
- `GET /api/v1/payments/history` - Get payment history
- `POST /api/v1/payments/:paymentId/refund` - Process refund
- `POST /api/v1/payments/:paymentId/cancel` - Cancel payment

### Webhook Management
- `POST /api/v1/webhooks/:provider` - Process provider webhook
- `GET /api/v1/webhooks/history` - Get webhook history
- `GET /api/v1/webhooks/:webhookId` - Get webhook details
- `POST /api/v1/webhooks/:webhookId/retry` - Retry failed webhook
- `GET /api/v1/webhooks/stats/overview` - Get webhook statistics
- `PUT /api/v1/webhooks/config/:provider` - Update webhook config

### Settlement Processing
- `POST /api/v1/settlements/batch` - Create settlement batch
- `GET /api/v1/settlements/:settlementId` - Get settlement details
- `GET /api/v1/settlements/history` - Get settlement history
- `POST /api/v1/settlements/:settlementId/process` - Process settlement
- `POST /api/v1/settlements/:settlementId/cancel` - Cancel settlement
- `GET /api/v1/settlements/stats/overview` - Get settlement statistics
- `PUT /api/v1/settlements/config` - Update settlement config

### Provider Management
- `GET /api/v1/providers/` - Get all payment providers
- `GET /api/v1/providers/:providerId` - Get provider details
- `POST /api/v1/providers/` - Create new provider
- `PUT /api/v1/providers/:providerId` - Update provider
- `DELETE /api/v1/providers/:providerId` - Delete provider
- `POST /api/v1/providers/:providerId/test` - Test provider connection
- `GET /api/v1/providers/:providerId/stats` - Get provider statistics
- `PUT /api/v1/providers/:providerId/config` - Update provider config

### Exchange Rate Management
- `GET /api/v1/exchange-rates/current` - Get current exchange rates
- `POST /api/v1/exchange-rates/convert` - Convert currency amount
- `GET /api/v1/exchange-rates/history` - Get exchange rate history
- `GET /api/v1/exchange-rates/stats` - Get exchange rate statistics
- `POST /api/v1/exchange-rates/update` - Update rates manually
- `POST /api/v1/exchange-rates/refresh` - Refresh rates from providers
- `GET /api/v1/exchange-rates/config` - Get exchange rate config
- `PUT /api/v1/exchange-rates/config` - Update exchange rate config

### Fraud Detection
- `POST /api/v1/fraud/analyze` - Analyze payment for fraud
- `GET /api/v1/fraud/rules` - Get fraud detection rules
- `POST /api/v1/fraud/rules` - Create fraud detection rule
- `PUT /api/v1/fraud/rules/:ruleId` - Update fraud detection rule
- `DELETE /api/v1/fraud/rules/:ruleId` - Delete fraud detection rule
- `GET /api/v1/fraud/alerts` - Get fraud alerts
- `PUT /api/v1/fraud/alerts/:alertId` - Update fraud alert status
- `GET /api/v1/fraud/stats/overview` - Get fraud detection statistics
- `PUT /api/v1/fraud/config` - Update fraud detection config

## 🔧 Environment Variables

```bash
# Service Configuration
PORT=3004
NODE_ENV=development

# Database
MONGODB_URI_DEV=mongodb://localhost:27017/quantum_mint_payments_dev
MONGODB_URI_PROD=mongodb://localhost:27017/quantum_mint_payments_prod
MONGODB_URI_TEST=mongodb://localhost:27017/quantum_mint_payments_test

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=2

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_USERNAME=guest
RABBITMQ_PASSWORD=guest

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=http://localhost:3006

# Logging
LOG_LEVEL=info
LOG_MAX_SIZE=20971520
LOG_MAX_FILES=14

# Payment Provider Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
ORANGE_MONEY_MERCHANT_ID=merchant_123
ORANGE_MONEY_CLIENT_ID=client_123
ORANGE_MONEY_CLIENT_SECRET=secret_123
AFRIMONEY_API_KEY=afri_api_key_123
AFRIMONEY_SECRET_KEY=afri_secret_123

# Fraud Detection
FRAUD_DETECTION_ENABLED=true
FRAUD_AUTO_BLOCK=false
FRAUD_RISK_THRESHOLD_HIGH=80
FRAUD_RISK_THRESHOLD_CRITICAL=90

# Exchange Rates
EXCHANGE_RATE_UPDATE_INTERVAL=3600000
EXCHANGE_RATE_CACHE_TTL=300000
EXCHANGE_RATE_PROVIDERS=default,backup1,backup2

# Settlement
SETTLEMENT_BATCH_SIZE=100
SETTLEMENT_INTERVAL_HOURS=24
SETTLEMENT_THRESHOLD_AMOUNT=1000.00
SETTLEMENT_AUTO_PROCESSING=true
```

## 🚀 Installation

### Prerequisites
- Node.js 18+ 
- MongoDB 6+
- Redis 6+
- RabbitMQ 3.8+

### Setup
```bash
# Clone the repository
git clone <repository-url>
cd payment-integration-service

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Update environment variables
# Edit .env file with your configuration

# Start the service
npm run dev
```

### Docker Deployment
```bash
# Build the image
docker build -t quantum-mint-payment-service .

# Run the container
docker run -d \
  --name payment-service \
  -p 3004:3004 \
  --env-file .env \
  quantum-mint-payment-service
```

### Docker Compose
```yaml
version: '3.8'
services:
  payment-service:
    build: .
    ports:
      - "3004:3004"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      - mongodb
      - redis
      - rabbitmq
    restart: unless-stopped
```

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Test Coverage
```bash
npm run test:coverage
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3004/health
```

### Metrics Endpoints
- `/api/v1/stats/overview` - Service overview statistics
- `/api/v1/stats/performance` - Performance metrics
- `/api/v1/stats/errors` - Error statistics

### Logging
The service uses Winston for structured logging with the following levels:
- `error` - Error conditions
- `warn` - Warning conditions
- `info` - General information
- `debug` - Debug information

Logs are stored in the `logs/` directory and also output to console.

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Protection against abuse and DDoS attacks
- **Input Validation**: Comprehensive request validation using express-validator
- **CORS Protection**: Configurable cross-origin resource sharing
- **Helmet Security**: Security headers and protection middleware
- **Webhook Signature Verification**: Secure webhook processing
- **Role-Based Access Control**: Different permission levels for different user roles

## 🔄 Message Queue Integration

The service integrates with RabbitMQ for:
- **Payment Events**: Payment processing notifications
- **Webhook Events**: Webhook processing events
- **Settlement Events**: Settlement processing notifications
- **Fraud Alerts**: Fraud detection alerts
- **Provider Events**: Payment provider status updates

### Queue Configuration
- `payment_processing` - Payment processing queue
- `webhook_processing` - Webhook processing queue
- `settlement_processing` - Settlement processing queue
- `fraud_alerts` - Fraud detection alerts queue
- `provider_events` - Provider event notifications queue

## ⚡ Performance Optimization

- **Redis Caching**: Cache frequently accessed data
- **Connection Pooling**: Optimized database connections
- **Async Processing**: Non-blocking operations for better performance
- **Batch Processing**: Efficient batch operations for settlements
- **Rate Limiting**: Prevent service overload
- **Compression**: Response compression for better network performance

## 🛠️ Error Handling

The service implements comprehensive error handling:
- **Centralized Error Handler**: Consistent error responses
- **Custom Error Classes**: Specific error types for different scenarios
- **Error Logging**: Detailed error logging with context
- **Graceful Degradation**: Service continues operating even with partial failures
- **Retry Mechanisms**: Automatic retry for transient failures

### Error Response Format
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## ⚙️ Configuration Management

- **Environment-based Configuration**: Different configs for different environments
- **Dynamic Configuration**: Runtime configuration updates
- **Provider Configuration**: Easy payment provider setup
- **Fraud Detection Rules**: Configurable fraud detection parameters
- **Settlement Configuration**: Adjustable settlement parameters

## 📚 API Documentation

### Authentication
All API endpoints require JWT authentication except for webhook endpoints.

### Request Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Response Format
```json
{
  "success": true,
  "data": {},
  "message": "Operation successful",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Pagination
For endpoints that return lists, pagination is supported:
```json
{
  "data": [],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 100
  }
}
```

## 🔗 Integration Points

### External Services
- **Stripe**: Payment processing and webhooks
- **Orange Money**: Mobile money integration
- **AfriMoney**: African payment gateway
- **Exchange Rate APIs**: Currency conversion services

### Internal Services
- **Authentication Service**: User authentication and authorization
- **Transaction Service**: Transaction management
- **KYC Service**: Identity verification
- **Notification Service**: User notifications

## 🚀 Deployment Considerations

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Configure production databases
- [ ] Set up SSL/TLS certificates
- [ ] Configure production payment provider keys
- [ ] Set up monitoring and alerting
- [ ] Configure backup and disaster recovery
- [ ] Set up CI/CD pipeline
- [ ] Configure load balancing

### Scaling
- **Horizontal Scaling**: Multiple service instances
- **Load Balancing**: Distribute traffic across instances
- **Database Sharding**: Distribute data across multiple databases
- **Cache Clustering**: Redis cluster for high availability

## 🛠️ Development Guidelines

### Code Style
- Use ES6+ features
- Follow ESLint configuration
- Write comprehensive tests
- Use async/await for asynchronous operations
- Implement proper error handling

### Adding New Features
1. Create feature branch
2. Implement feature with tests
3. Update documentation
4. Create pull request
5. Code review and merge

### Testing
- Write unit tests for all functions
- Write integration tests for API endpoints
- Maintain test coverage above 80%
- Use mock data for external services

## 🔮 Future Enhancements

- **Additional Payment Providers**: PayPal, Apple Pay, Google Pay
- **Advanced Fraud Detection**: Machine learning-based fraud detection
- **Real-time Analytics**: Live payment analytics dashboard
- **Multi-tenant Support**: Support for multiple organizations
- **Advanced Settlement**: Automated settlement optimization
- **Payment Routing**: Intelligent payment provider selection
- **Compliance Tools**: Enhanced regulatory compliance features

## 📞 Support

For support and questions:
- **Documentation**: Check this README and API documentation
- **Issues**: Create GitHub issues for bugs and feature requests
- **Discussions**: Use GitHub discussions for general questions
- **Email**: Contact the development team

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for more information.

---

**QuantumMint Payment Integration Service** - Powering secure and efficient digital payments.
