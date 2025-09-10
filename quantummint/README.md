# QuantumMint Digital Money Platform

A comprehensive digital money generation and management platform built with microservices architecture, featuring quantum-inspired algorithms for secure money generation, KYC verification, payment integration, and wallet management.

## 🚀 Features

### Core Services
- **API Gateway**: Unified entry point with authentication and rate limiting
- **Authentication Service**: JWT-based auth with 2FA support
- **Money Generation Service**: Quantum-inspired digital currency generation
- **Transaction Service**: Secure transaction processing and balance management
- **Payment Integration**: Multi-provider payment processing (Stripe, Orange Money, AfriMoney)
- **KYC Service**: Identity verification with document processing and compliance checks

### Frontend
- **React Application**: Modern, responsive web interface
- **Material-UI Components**: Professional UI/UX design
- **Real-time Updates**: Live transaction and balance updates
- **Mobile Responsive**: Optimized for all device sizes

### Infrastructure
- **MongoDB**: Primary database for all services
- **Redis**: Caching and session management
- **RabbitMQ**: Message queuing for async operations
- **Docker**: Containerized deployment
- **Nginx**: Load balancing and static file serving

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   Auth Service  │
│   (React)       │◄──►│   (Port 3000)   │◄──►│   (Port 3001)   │
│   (Port 80)     │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
        ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
        │ Money Generation│ │ Transaction Svc │ │ Payment Service │
        │   (Port 3002)   │ │   (Port 3003)   │ │   (Port 3004)   │
        └─────────────────┘ └─────────────────┘ └─────────────────┘
                    │
            ┌─────────────────┐
            │   KYC Service   │
            │   (Port 3005)   │
            └─────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   MongoDB   │ │    Redis    │ │  RabbitMQ   │
│ (Port 27017)│ │ (Port 6379) │ │(Port 5672)  │
└─────────────┘ └─────────────┘ └─────────────┘
```

## 🛠️ Quick Start

### Prerequisites
- Docker Desktop
- Docker Compose
- Git

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd quantummint
   ```

2. **Start development environment**
   
   **Windows:**
   ```cmd
   start-dev.bat
   ```
   
   **Linux/Mac:**
   ```bash
   ./scripts/dev-start.sh
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - API Gateway: http://localhost:3000/api
   - RabbitMQ Management: http://localhost:15672

### Production Deployment

1. **Configure environment**
   ```bash
   cp .env.docker.example .env
   # Edit .env with your production values
   ```

2. **Deploy services**
   
   **Windows:**
   ```cmd
   scripts\deploy.bat
   ```
   
   **Linux/Mac:**
   ```bash
   ./scripts/deploy.sh
   ```

## 📋 Services Overview

### API Gateway (Port 3000)
- Request routing and load balancing
- Authentication middleware
- Rate limiting and security headers
- API documentation with Swagger
- CORS and security configuration

### Authentication Service (Port 3001)
- User registration and login
- JWT token management
- Two-factor authentication (2FA)
- Password reset functionality
- Role-based access control

### Money Generation Service (Port 3002)
- Quantum-inspired money generation algorithms
- Configurable complexity levels
- Generation history and statistics
- Daily limits and security controls
- Integration with transaction service

### Transaction Service (Port 3003)
- Secure transaction processing
- Balance management and tracking
- Transaction history and analytics
- Fund locking and unlocking
- Transfer capabilities

### Payment Integration Service (Port 3004)
- Multi-provider payment processing
- Stripe integration for credit cards
- Orange Money for mobile payments
- AfriMoney for African markets
- Webhook handling and verification

### KYC Service (Port 3005)
- Identity document verification
- Compliance checks (sanctions, PEP, adverse media)
- Document processing and storage
- Risk assessment and scoring
- Manual review workflows

## 🔧 Configuration

### Environment Variables

Key configuration options:

```env
# Database
MONGODB_URI=mongodb://admin:password@mongodb:27017/quantummint
REDIS_URL=redis://:password@redis:6379

# JWT
JWT_SECRET=your_super_secure_secret
JWT_EXPIRES_IN=24h

# Payment Providers
STRIPE_SECRET_KEY=sk_test_...
ORANGE_MONEY_API_KEY=your_api_key
AFRIMONEY_API_KEY=your_api_key

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=jpg,jpeg,png,pdf
```

### Service Configuration

Each service can be configured independently through environment variables and configuration files located in their respective directories.

## 🧪 Development

### Project Structure
```
quantummint/
├── api-gateway/          # API Gateway service
├── auth-service/         # Authentication service
├── money-generation/     # Money generation service
├── transaction-service/  # Transaction processing
├── payment-integration/  # Payment providers
├── kyc-service/         # KYC verification
├── frontend/            # React frontend
├── shared/              # Shared utilities
├── scripts/             # Deployment scripts
└── docker-compose.yml   # Docker configuration
```

### Adding New Services

1. Create service directory
2. Add Dockerfile and Dockerfile.dev
3. Update docker-compose.yml
4. Add service routes to API Gateway
5. Update deployment scripts

### Hot Reloading

Development environment includes hot reloading:
- Backend services use nodemon
- Frontend uses React development server
- File changes automatically restart services

## 📊 Monitoring and Logs

### Viewing Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api-gateway

# Follow logs in real-time
docker-compose logs -f --tail=100
```

### Health Checks
All services include health check endpoints:
- `GET /health` - Service health status
- `GET /metrics` - Service metrics (if implemented)

## 🔒 Security

### Authentication
- JWT tokens with configurable expiration
- Two-factor authentication support
- Password strength requirements
- Account lockout after failed attempts

### API Security
- Rate limiting on all endpoints
- CORS configuration
- Security headers (Helmet.js)
- Input validation and sanitization

### Data Protection
- Encrypted password storage (bcrypt)
- Secure file upload handling
- Database connection encryption
- Environment variable protection

## 🚀 Deployment

### Docker Deployment
The platform is fully containerized with Docker:
- Multi-stage builds for optimization
- Health checks for reliability
- Volume persistence for data
- Network isolation for security

### Scaling
Services can be scaled independently:
```bash
docker-compose up -d --scale transaction-service=3
```

### Load Balancing
API Gateway handles load balancing and service discovery automatically.

## 🛠️ Maintenance

### Backup
```bash
# Create backup
./scripts/backup.sh

# Restore from backup
tar -xzf backup.tar.gz
# Follow restore instructions in backup_info.txt
```

### Cleanup
```bash
# Clean containers only
./scripts/cleanup.sh --containers

# Complete cleanup (WARNING: Deletes all data)
./scripts/cleanup.sh --all
```

### Updates
1. Pull latest code
2. Rebuild images: `docker-compose build`
3. Restart services: `docker-compose up -d`

## 📚 API Documentation

API documentation is available at:
- Development: http://localhost:3000/api-docs
- Production: https://your-domain.com/api-docs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the logs for error details

## 🔄 Version History

### v1.0.0
- Initial release
- Core microservices implementation
- React frontend
- Docker deployment
- Payment integration
- KYC verification system

---

**QuantumMint** - Secure Digital Money Platform
