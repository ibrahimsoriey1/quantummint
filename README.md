# QuantumMint - Digital Money Generator

QuantumMint is a comprehensive digital money generation platform that allows users to create, manage, and transact with digital currency. The system is built with a microservices architecture, providing a scalable and maintainable solution.

## System Architecture

QuantumMint is built using a microservices architecture with the following components:

### Core Services

1. **API Gateway**: Entry point for all client requests, handling routing, authentication verification, and request proxying
2. **Authentication Service**: Manages user registration, login, and security
3. **Money Generation Service**: Handles the creation and management of digital money
4. **Transaction Service**: Processes and records all financial transactions
5. **Payment Integration Service**: Connects with external payment providers
6. **KYC Service**: Handles Know Your Customer verification processes
7. **Frontend**: React-based user interface

### Technology Stack

- **Backend**: Node.js with Express
- **Frontend**: React with Material UI
- **Database**: MongoDB
- **Authentication**: JWT with two-factor authentication
- **Message Queue**: RabbitMQ for service communication
- **Caching**: Redis
- **Containerization**: Docker
- **API Documentation**: Swagger

## Features

### User Management
- User registration and authentication
- Two-factor authentication
- Profile management
- Role-based access control

### Money Generation
- Multiple generation methods
- Generation limits and controls
- Generation history tracking
- Wallet management

### Transactions
- Transfer between users
- Deposit and withdrawal
- Transaction history
- Balance tracking

### Payment Integration
- Support for multiple payment providers
- Secure payment processing
- Fee calculation
- Payment method management

### KYC Verification
- Identity verification
- Document upload and verification
- Verification status tracking
- Compliance management

### Security
- JWT-based authentication
- Two-factor authentication
- Rate limiting
- Input validation
- Data encryption

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Redis
- RabbitMQ
- Docker (optional)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/quantummint.git
   cd quantummint
   ```

2. Install dependencies for all services:
   ```
   npm run install-all
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env` in each service directory
   - Update the variables with your configuration

4. Start the services:
   ```
   npm run start
   ```

### Using Docker

1. Copy the environment variables file:
   ```
   cd docker
   cp .env.example .env
   ```

2. Update the `.env` file with your configuration

3. Build and start the containers:
   ```
   ./deploy.sh --environment dev --build
   ```

## API Documentation

API documentation is available at `/api-docs` when the API Gateway is running. This provides a comprehensive overview of all available endpoints and their usage.

## Service Ports

- API Gateway: 3000
- Authentication Service: 3001
- Money Generation Service: 3002
- Transaction Service: 3003
- Payment Integration Service: 3004
- KYC Service: 3005
- Frontend: 3006

## Development

### Project Structure

```
quantummint/
├── api-gateway/            # API Gateway service
├── auth-service/           # Authentication service
├── money-generation/       # Money generation service
├── transaction-service/    # Transaction service
├── payment-integration/    # Payment integration service
├── kyc-service/            # KYC verification service
├── frontend/               # React frontend application
├── docker/                 # Docker configuration files
└── shared/                 # Shared utilities and models
```

### Running Individual Services

Each service can be run independently for development:

```
cd <service-directory>
npm run dev
```

This will start the service in development mode with hot reloading.

### Testing

Run tests for all services:

```
npm test
```

Or for a specific service:

```
cd <service-directory>
npm test
```

## Deployment

The application can be deployed using Docker and Docker Compose:

```
cd docker
./deploy.sh --environment prod --build
```

## CI/CD Pipeline

The project includes a GitHub Actions workflow for continuous integration and deployment:

1. **Testing**: Runs linting and unit tests for each service
2. **Building**: Builds Docker images for each service
3. **Deployment**: Deploys to staging or production environments based on the branch

## Documentation

- User guides are available in the `docs` directory of each service
- API documentation is available at `/api-docs` when the API Gateway is running
- Technical documentation is available in the `docs` directory of the project

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- The NinjaTech AI team for their support and guidance
- All contributors to the project