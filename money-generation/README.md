# Money Generation Service

The Money Generation Service is a core microservice of the QuantumMint platform, responsible for generating digital currency using advanced algorithms including quantum-inspired, cryptographic, mathematical, and hybrid approaches.

## Features

- **Multiple Generation Algorithms**: Quantum, Cryptographic, Mathematical, and Hybrid
- **Wallet Management**: User wallet creation, balance management, and transaction tracking
- **Advanced Security**: Rate limiting, cooldown periods, and fraud detection
- **Real-time Processing**: Asynchronous money generation with progress tracking
- **Comprehensive Analytics**: Detailed statistics and performance metrics
- **Multi-currency Support**: USD, EUR, GBP, XAF, XOF, BTC, ETH, QMT

## Architecture

### Core Components

1. **Generation Algorithms**
   - Quantum Algorithm: Quantum-inspired randomness and security
   - Cryptographic Algorithm: AES-256 encryption with SHA-512 hashing
   - Mathematical Algorithm: Complex mathematical transformations
   - Hybrid Algorithm: Multi-algorithm consensus for maximum security

2. **Wallet Management**
   - Automatic wallet creation
   - Multi-currency balance tracking
   - Balance locking/unlocking mechanisms
   - Transaction history and limits

3. **Security Features**
   - JWT authentication
   - Rate limiting and cooldown periods
   - IP-based restrictions
   - Fraud detection and risk scoring

4. **Message Queue Integration**
   - RabbitMQ for inter-service communication
   - Asynchronous processing
   - Event-driven architecture

## API Endpoints

### Generation Routes (`/api/v1/generation`)

- `POST /` - Start money generation
- `GET /` - Get user's generation history
- `GET /:id` - Get specific generation details
- `POST /:id/cancel` - Cancel pending generation
- `GET /stats/overview` - Get generation statistics overview
- `GET /stats/detailed` - Get detailed generation statistics
- `POST /bulk` - Bulk generation (admin only)
- `GET /status/:id` - Get generation status
- `POST /:id/retry` - Retry failed generation
- `GET /limits` - Get user's generation limits
- `POST /limits/request` - Request limit increase

### Wallet Routes (`/api/v1/wallet`)

- `GET /` - Get user's wallet information
- `GET /balance` - Get wallet balances
- `POST /balance/add` - Add balance to wallet (admin only)
- `POST /balance/subtract` - Subtract balance from wallet (admin only)
- `POST /balance/lock` - Lock balance in wallet
- `POST /balance/unlock` - Unlock balance in wallet
- `GET /transactions` - Get wallet transaction history
- `GET /limits` - Get wallet limits
- `PUT /limits` - Update wallet limits (admin only)
- `GET /status` - Get wallet status
- `POST /backup` - Create wallet backup
- `POST /restore` - Restore wallet from backup (admin only)

### Algorithm Routes (`/api/v1/algorithm`)

- `GET /` - Get available algorithms
- `GET /:name` - Get specific algorithm details
- `POST /:name/test` - Test algorithm performance (admin only)
- `GET /:name/performance` - Get algorithm performance metrics
- `POST /:name/configure` - Configure algorithm parameters (admin only)
- `GET /compare` - Compare algorithm performance
- `GET /status/overview` - Get overall algorithm system status
- `POST /maintenance` - Trigger algorithm maintenance (admin only)

### Statistics Routes (`/api/v1/stats`)

- `GET /overview` - Get system overview statistics
- `GET /generation` - Get generation statistics
- `GET /wallet` - Get wallet statistics
- `GET /user/:userId` - Get user-specific statistics
- `GET /performance` - Get system performance metrics
- `GET /export` - Export statistics data (admin only)

## Environment Variables

```env
# Server Configuration
NODE_ENV=development
PORT=3002
HOST=0.0.0.0

# Database Configuration
MONGODB_URI=mongodb://mongodb:27017/quantummint
MONGODB_URI_TEST=mongodb://mongodb:27017/quantummint_test

# Redis Configuration
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=
REDIS_DB=1

# RabbitMQ Configuration
RABBITMQ_URL=amqp://rabbitmq:5672
RABBITMQ_USERNAME=guest
RABBITMQ_PASSWORD=guest

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Money Generation Configuration
GENERATION_LIMIT_DAILY=1000
GENERATION_LIMIT_MONTHLY=10000
GENERATION_LIMIT_YEARLY=100000
GENERATION_COOLDOWN_MINUTES=30
GENERATION_ALGORITHM_VERSION=v1.0

# Security Configuration
ENCRYPTION_KEY=your-32-character-encryption-key
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging Configuration
LOG_LEVEL=info
LOG_FILE_PATH=./logs/money-generation.log

# CORS Configuration
CORS_ORIGIN=http://localhost:3006
CORS_CREDENTIALS=true

# API Configuration
API_VERSION=v1
API_PREFIX=/api/v1

# Service URLs
AUTH_SERVICE_URL=http://auth-service:3001
TRANSACTION_SERVICE_URL=http://transaction-service:3003
WALLET_SERVICE_URL=http://wallet-service:3007

# Monitoring Configuration
ENABLE_METRICS=true
METRICS_PORT=9091
PROMETHEUS_ENDPOINT=/metrics
```

## Installation

### Prerequisites

- Node.js 18+
- MongoDB 6+
- Redis 6+
- RabbitMQ 3.8+

### Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start the service:
   ```bash
   npm run dev
   ```

### Docker

1. Build the image:
   ```bash
   docker build -t quantummint-money-generation .
   ```

2. Run the container:
   ```bash
   docker run -p 3002:3002 --env-file .env quantummint-money-generation
   ```

## Usage Examples

### Start Money Generation

```bash
curl -X POST http://localhost:3002/api/v1/generation \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "currency": "USD",
    "algorithm": "quantum"
  }'
```

### Get Wallet Balance

```bash
curl -X GET http://localhost:3002/api/v1/wallet/balance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Generation Statistics

```bash
curl -X GET "http://localhost:3002/api/v1/stats/generation?startDate=2024-01-01&endDate=2024-01-31&groupBy=day" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Algorithm Details

### Quantum Algorithm
- **Purpose**: High-security generation for medium amounts
- **Features**: Quantum-like randomness, advanced seed generation
- **Fee Rate**: 1.2%
- **Processing Time**: Medium (1-3 seconds)
- **Security Level**: High

### Cryptographic Algorithm
- **Purpose**: Standard security for low to medium amounts
- **Features**: AES-256 encryption, SHA-512 hashing
- **Fee Rate**: 1.0%
- **Processing Time**: Fast (0.5-2 seconds)
- **Security Level**: High

### Mathematical Algorithm
- **Purpose**: Fast processing for small amounts
- **Features**: Mathematical transformations, constants
- **Fee Rate**: 0.8%
- **Processing Time**: Very fast (0.2-1.2 seconds)
- **Security Level**: Medium

### Hybrid Algorithm
- **Purpose**: Maximum security for large amounts
- **Features**: Multi-algorithm consensus, triple validation
- **Fee Rate**: 1.5%
- **Processing Time**: Long (3-8 seconds)
- **Security Level**: Maximum

## Security Features

### Rate Limiting
- Configurable request limits per time window
- IP-based rate limiting
- User-based rate limiting for authenticated requests

### Cooldown Periods
- Automatic cooldown after generation attempts
- Configurable cooldown duration
- Reason-based cooldown activation

### Fraud Detection
- Risk scoring based on multiple factors
- Suspicious activity flagging
- Automatic review requirements for high-risk operations

### Authentication & Authorization
- JWT token validation
- Role-based access control
- Resource ownership verification

## Monitoring & Logging

### Logging
- Winston-based structured logging
- Multiple log levels (error, warn, info, debug)
- File and console output
- Custom log categories for different operations

### Health Checks
- `/health` endpoint for service status
- Database connectivity checks
- Redis connectivity checks
- RabbitMQ connectivity checks

### Metrics
- Generation success rates
- Processing time metrics
- Algorithm performance statistics
- System resource usage

## Testing

### Run Tests
```bash
npm test
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

## Development

### Code Style
- ESLint configuration included
- Standard JavaScript style guide
- Pre-commit hooks recommended

### API Documentation
- RESTful API design
- Comprehensive error handling
- Input validation using express-validator
- Async/await pattern usage

### Database Models
- Mongoose schemas with validation
- Indexes for performance optimization
- Virtual properties and methods
- Pre-save and post-save middleware

## Deployment

### Production Considerations
- Environment-specific configurations
- Health check endpoints
- Graceful shutdown handling
- Process management (PM2 recommended)
- Load balancing configuration
- SSL/TLS termination

### Scaling
- Horizontal scaling with multiple instances
- Database connection pooling
- Redis clustering for high availability
- RabbitMQ clustering for message reliability

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Check MongoDB service status
   - Verify connection string in .env
   - Check network connectivity

2. **Redis Connection Failed**
   - Check Redis service status
   - Verify Redis URL in .env
   - Check Redis authentication

3. **RabbitMQ Connection Failed**
   - Check RabbitMQ service status
   - Verify connection credentials
   - Check queue and exchange setup

4. **Generation Fails**
   - Check user verification status
   - Verify generation limits
   - Check cooldown periods
   - Review algorithm configuration

### Debug Mode
Enable debug logging by setting:
```env
LOG_LEVEL=debug
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## Changelog

### v1.0.0
- Initial release
- Core generation algorithms
- Wallet management
- Comprehensive API
- Security features
- Monitoring and logging
