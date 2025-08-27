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